import mongoose from 'mongoose';
import sharp from 'sharp';
import ImageKit from 'imagekit';
import { Order } from '../models/Order';
import { Shop } from '../models/Shop';
import { ServiceZone } from '../models/ServiceZone';
import { User } from '../models/User';
import { PharmacyCatalog } from '../models/PharmacyCatalog';
import { OrderStatus, Category } from '@shared/types';
import { getIO } from '../socket/socket';
import { SocketEvent } from '@shared/constants/socketEvents';
import { WalletService } from './WalletService';
import { NotificationService } from './notificationService';
import { NotificationType } from '../models/Notification';
import { FCMService } from './fcmService';
import { AppError } from '../utils/errors';
import { ZoneService } from './ZoneService';

// ── Constants ──────────────────────────────────────────────────────────────────
const BROADCAST_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Indian mobile number patterns (all formats: +91, 0, bare 10-digit)
const INDIAN_PHONE_REGEX =
  /(?:(?:\+?91|0)[\s\-]?)?(?:[6-9]\d{9})|(?:[6-9]\d{4}[\s\-]\d{5})/g;

// Tracks active broadcast timers keyed by orderId (in-memory only, recovered on restart)
const broadcastTimers = new Map<string, NodeJS.Timeout>();

// ── ImageKit client (singleton lazy init) ──────────────────────────────────────
let _ik: ImageKit | null = null;
function getIK(): ImageKit {
  if (!_ik) {
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
    if (!publicKey || !privateKey || !urlEndpoint) {
      throw new AppError('ImageKit credentials not configured', 500);
    }
    _ik = new ImageKit({ publicKey, privateKey, urlEndpoint });
  }
  return _ik;
}

export class PharmacyService {
  // ─── CATALOG SEARCH ──────────────────────────────────────────────────────────

  static async searchCatalog(query: string, limit = 20) {
    if (!query || query.trim().length < 2) {
      return PharmacyCatalog.find({ isActive: true })
        .sort({ name: 1 })
        .limit(limit)
        .lean();
    }
    // Use MongoDB text index with score sorting
    return PharmacyCatalog.find(
      { $text: { $search: query }, isActive: true },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .lean();
  }

  static async getCatalogItem(id: string) {
    const item = await PharmacyCatalog.findById(id).lean();
    if (!item) throw new AppError('Medicine not found in catalog', 404);
    return item;
  }

  // ─── BROADCAST ────────────────────────────────────────────────────────────────

  /**
   * Called immediately after a pharmacy order is created.
   * Finds all verified pharmacy shops inside the buyer's ServiceZone,
   * emits real-time + FCM to each, and arms the 10-minute auto-expire timer.
   */
  static async broadcast(orderId: string, buyerCoords: [number, number]) {
    const [lng, lat] = buyerCoords;

    // Find which ServiceZone the buyer is in
    const zone = await ZoneService.checkServiceability(lng, lat);
    if (!zone) {
      // No service zone — auto-cancel immediately
      await this._cancelNoZone(orderId);
      return;
    }

    // All verified pharmacy shops whose location falls within the zone radius
    const zoneCenter = zone.center.coordinates; // [lng, lat]
    const radiusMeters = zone.radius * 1000;

    const pharmacyShops = await Shop.find({
      category: Category.PHARMACY,
      isVerified: true,
      location: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: zoneCenter },
          $maxDistance: radiusMeters,
        },
      },
    })
      .select('_id owner name')
      .lean();

    if (pharmacyShops.length === 0) {
      await this._cancelNoPharmacy(orderId);
      return;
    }

    const shopIds = pharmacyShops.map((s) => s._id.toString());
    const expiry = new Date(Date.now() + BROADCAST_WINDOW_MS);

    // Atomically set broadcastedTo + expiry (race-safe)
    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        $set: {
          broadcastedTo: shopIds,
          broadcastExpiry: expiry,
          status: OrderStatus.PHARMACY_BROADCASTING,
        },
      },
      { new: true }
    )
      .populate('buyer', 'name')
      .populate('catalogItems.catalogItem', 'name form strength')
      .lean();

    if (!order) throw new AppError('Order not found during broadcast', 404);

    const broadcastPayload = {
      orderId,
      expiry: expiry.toISOString(),
      totalItems: (order.catalogItems || []).length,
      hasPrescription: !!order.prescriptionRedactedUrl,
      totalPrice: order.totalPrice,
      deliveryCharge: order.deliveryCharge || 0,
      // Intentionally NOT including buyer name / phone / address
    };

    const io = getIO();
    const ownerIds: string[] = [];

    for (const shop of pharmacyShops) {
      const ownerId = shop.owner.toString();
      ownerIds.push(ownerId);
      // Socket: shop owner is in their private room keyed by userId
      io.to(ownerId).emit(SocketEvent.PHARMACY_ORDER_BROADCAST, broadcastPayload);
    }

    // FCM push in parallel — fire-and-forget (failures don't break broadcast)
    Promise.allSettled(
      ownerIds.map((ownerId) =>
        FCMService.sendToUser(
          ownerId,
          '💊 New Pharmacy Order',
          `${(order.catalogItems || []).length} item(s) — ₹${order.totalPrice}. Accept within 10 minutes.`,
          { type: 'PHARMACY_BROADCAST', orderId }
        )
      )
    );

    // Notify buyer that we are searching
    await NotificationService.send({
      recipient: (order.buyer as any)?._id?.toString() || order.buyer?.toString(),
      type: NotificationType.ORDER,
      title: 'Finding Pharmacy',
      message: 'We are broadcasting your order to nearby pharmacies. You will be notified once a pharmacy accepts.',
      relatedId: orderId,
      data: { status: OrderStatus.PHARMACY_BROADCASTING, orderId },
    });

    // Arm auto-expire timer
    this._armTimer(orderId, expiry);
  }

  // ─── ACCEPT ORDER ────────────────────────────────────────────────────────────

  /**
   * Atomic accept by a pharmacy shop owner.
   * Uses findOneAndUpdate with seller:null guard so only one shop wins the race.
   */
  static async acceptOrder(orderId: string, shopId: string) {
    const shop = await Shop.findById(shopId).select('owner name category isVerified').lean();
    if (!shop) throw new AppError('Shop not found', 404);
    if (!shop.isVerified) throw new AppError('Your shop is not verified', 403);
    if (shop.category !== Category.PHARMACY) throw new AppError('Only pharmacy shops can accept pharmacy orders', 403);

    // Atomic accept — only succeeds if seller is still null and status is PHARMACY_BROADCASTING
    const accepted = await Order.findOneAndUpdate(
      {
        _id: orderId,
        seller: null,
        status: OrderStatus.PHARMACY_BROADCASTING,
        broadcastedTo: shopId,     // must have been part of the broadcast
        broadcastExpiry: { $gt: new Date() }, // must not be expired
      },
      {
        $set: {
          seller: shop.owner,
          shop: shopId,
          status: OrderStatus.CONFIRMED,
        },
      },
      { new: true }
    )
      .populate('buyer', 'name phoneNumber')
      .populate('catalogItems.catalogItem', 'name strength form')
      .lean();

    if (!accepted) {
      // Could be: already taken, expired, or this shop wasn't notified
      const current = await Order.findById(orderId).select('status seller broadcastExpiry').lean();
      if (!current) throw new AppError('Order not found', 404);
      if (current.status !== OrderStatus.PHARMACY_BROADCASTING) {
        throw new AppError('This order has already been accepted by another pharmacy', 409);
      }
      if (current.broadcastExpiry && current.broadcastExpiry < new Date()) {
        throw new AppError('The broadcast window for this order has expired', 410);
      }
      throw new AppError('Unable to accept this order', 400);
    }

    // Cancel the auto-expire timer — order is taken
    this._clearTimer(orderId);

    const buyerId = (accepted.buyer as any)?._id?.toString() || accepted.buyer?.toString();
    const io = getIO();

    // Notify all other shops in the broadcast that the order is taken
    const broadcastedTo: string[] = (accepted.broadcastedTo || []).map((id: any) =>
      id.toString()
    );
    const winnerShopId = shopId.toString();

    for (const broadcastedShopId of broadcastedTo) {
      if (broadcastedShopId === winnerShopId) continue;
      // Get owner of the losing shop to notify them
      const losingShop = await Shop.findById(broadcastedShopId).select('owner').lean();
      if (losingShop) {
        const losingOwnerId = losingShop.owner.toString();
        io.to(losingOwnerId).emit(SocketEvent.PHARMACY_ORDER_TAKEN, { orderId });
      }
    }

    // Notify buyer
    await NotificationService.send({
      recipient: buyerId,
      type: NotificationType.ORDER,
      title: '✅ Pharmacy Found!',
      message: `${shop.name} has accepted your order. Preparing your medicines now.`,
      relatedId: orderId,
      data: { status: OrderStatus.CONFIRMED, orderId, shopName: shop.name },
    });

    // Sync real-time order card to buyer
    const fullOrder = await Order.findById(orderId)
      .populate('shop', 'name logo address contactInfo')
      .populate('catalogItems.catalogItem', 'name strength form')
      .lean();
    io.to(buyerId).emit(SocketEvent.ORDER_STATUS_UPDATED, fullOrder);

    // Notify the winning shop owner
    io.to(shop.owner.toString()).emit(SocketEvent.ORDER_STATUS_UPDATED, fullOrder);

    return accepted;
  }

  // ─── AUTO-EXPIRE ─────────────────────────────────────────────────────────────

  /**
   * Called when the 10-minute broadcast window closes without any shop accepting.
   * Cancels the order and refunds the buyer.
   */
  static async autoExpire(orderId: string) {
    // Re-check status atomically to handle the race between timer fire and late accept
    const updated = await Order.findOneAndUpdate(
      { _id: orderId, status: OrderStatus.PHARMACY_BROADCASTING },
      { $set: { status: OrderStatus.CANCELLED, cancellationReason: 'No pharmacy accepted within 10 minutes' } },
      { new: true }
    ).lean();

    if (!updated) {
      // Order was accepted just as the timer fired — do nothing
      console.log(`[PHARMACY] autoExpire noop for ${orderId}: already resolved`);
      return;
    }

    console.log(`[PHARMACY] Order ${orderId} expired. Refunding buyer.`);
    this._clearTimer(orderId);

    // Refund buyer
    try {
      await WalletService.refundToWallet(orderId);
    } catch (err) {
      console.error(`[PHARMACY] Refund failed for expired order ${orderId}:`, err);
      // Admin alert via notification to all admin users
    }

    const buyerId = updated.buyer?.toString();
    if (buyerId) {
      const io = getIO();

      await NotificationService.send({
        recipient: buyerId,
        type: NotificationType.ORDER,
        title: 'No Pharmacy Available',
        message: 'Sorry, no pharmacy accepted your order within the time limit. Your payment has been refunded.',
        relatedId: orderId,
        data: { status: OrderStatus.CANCELLED, orderId },
      });

      // Sync order card
      const fullOrder = await Order.findById(orderId)
        .populate('catalogItems.catalogItem', 'name strength form')
        .lean();
      io.to(buyerId).emit(SocketEvent.ORDER_STATUS_UPDATED, fullOrder);
      io.to(buyerId).emit(SocketEvent.PHARMACY_ORDER_EXPIRED, { orderId });
    }

    // Alert all shops that were part of this broadcast
    const broadcastedTo: string[] = ((updated as any).broadcastedTo || []).map((id: any) =>
      id.toString()
    );
    const io = getIO();
    for (const shopId of broadcastedTo) {
      const shop = await Shop.findById(shopId).select('owner').lean();
      if (shop) {
        io.to(shop.owner.toString()).emit(SocketEvent.PHARMACY_ORDER_EXPIRED, { orderId });
      }
    }
  }

  // ─── PRESCRIPTION PROCESSING ─────────────────────────────────────────────────

  /**
   * Processes a prescription image:
   * 1. Uploads the original (full-resolution) to a private ImageKit folder — never shared.
   * 2. Attempts OCR-based phone number detection using tesseract.js if available.
   * 3. Falls back to applying a privacy-awareness banner over the image.
   * 4. Returns URLs for both versions.
   *
   * The redacted URL is safe to share with the pharmacist.
   * The original URL is stored for audit/admin purposes only.
   */
  static async processPrescription(imageBuffer: Buffer): Promise<{
    originalUrl: string;
    redactedUrl: string;
  }> {
    // Normalize to JPEG for consistent processing
    const normalizedBuffer = await sharp(imageBuffer)
      .jpeg({ quality: 90 })
      .toBuffer();

    const { width = 0, height = 0 } = await sharp(normalizedBuffer).metadata();

    // Upload original to private folder (never exposed to sellers)
    const ik = getIK();
    const timestamp = Date.now();

    const originalUpload = await ik.upload({
      file: normalizedBuffer,
      fileName: `rx-original-${timestamp}.jpg`,
      folder: '/velto/prescriptions/private',
      useUniqueFileName: true,
    });

    let redactedBuffer = normalizedBuffer;

    // Try OCR-based redaction, fall back gracefully
    try {
      redactedBuffer = await this._redactPhoneNumbers(normalizedBuffer, width, height);
    } catch (ocrErr) {
      console.warn('[PHARMACY] OCR redaction failed, using banner fallback:', ocrErr);
      redactedBuffer = await this._applyPrivacyBanner(normalizedBuffer, width, height);
    }

    const redactedUpload = await ik.upload({
      file: redactedBuffer,
      fileName: `rx-redacted-${timestamp}.jpg`,
      folder: '/velto/prescriptions/redacted',
      useUniqueFileName: true,
    });

    return {
      originalUrl: originalUpload.url,
      redactedUrl: redactedUpload.url,
    };
  }

  /**
   * Attempts to detect and black out phone numbers using tesseract.js OCR.
   * tesseract.js is an optional peer dependency — if not installed this throws.
   */
  private static async _redactPhoneNumbers(
    imageBuffer: Buffer,
    width: number,
    height: number
  ): Promise<Buffer> {
    // Dynamic require so the server still starts if tesseract.js is not installed
    const Tesseract = require('tesseract.js');

    const { data } = await Tesseract.recognize(imageBuffer, 'eng+hin', {
      logger: () => {},
    });

    // words comes back as an array of { text, bbox: { x0, y0, x1, y1 } }
    const words: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> =
      data.words || [];

    // Group consecutive words into chunks of up to 4 (phone can be written across words)
    const phoneRegions: Array<{ x: number; y: number; w: number; h: number }> = [];
    const PADDING = 4;

    for (let i = 0; i < words.length; i++) {
      // Build candidate string from this word + up to 3 next words
      let candidate = '';
      let maxJ = Math.min(i + 3, words.length - 1);
      let minX = words[i].bbox.x0;
      let minY = words[i].bbox.y0;
      let maxX = words[i].bbox.x1;
      let maxY = words[i].bbox.y1;

      for (let j = i; j <= maxJ; j++) {
        candidate += words[j].text;
        minX = Math.min(minX, words[j].bbox.x0);
        minY = Math.min(minY, words[j].bbox.y0);
        maxX = Math.max(maxX, words[j].bbox.x1);
        maxY = Math.max(maxY, words[j].bbox.y1);

        // Test full candidate so far
        const cleaned = candidate.replace(/[\s\-\(\)\.]/g, '');
        if (INDIAN_PHONE_REGEX.test(cleaned)) {
          INDIAN_PHONE_REGEX.lastIndex = 0;
          phoneRegions.push({
            x: Math.max(0, minX - PADDING),
            y: Math.max(0, minY - PADDING),
            w: Math.min(width, maxX - minX + PADDING * 2),
            h: Math.min(height, maxY - minY + PADDING * 2),
          });
          // Skip the words we consumed to avoid duplicate boxes
          i = j;
          break;
        }
        INDIAN_PHONE_REGEX.lastIndex = 0;
      }
    }

    if (phoneRegions.length === 0) {
      return imageBuffer; // nothing to redact
    }

    // Compose black rectangles over detected phone regions
    const svgRects = phoneRegions
      .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="black"/>`)
      .join('');

    const overlay = Buffer.from(
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgRects}</svg>`
    );

    return sharp(imageBuffer)
      .composite([{ input: overlay, blend: 'over' }])
      .jpeg({ quality: 88 })
      .toBuffer();
  }

  /**
   * Fallback: adds a privacy-awareness banner to the prescription
   * when OCR is not available. The prescription is still sent to the pharmacist
   * but with a clearly visible notice that patient contact details are private.
   */
  private static async _applyPrivacyBanner(
    imageBuffer: Buffer,
    width: number,
    height: number
  ): Promise<Buffer> {
    const bannerH = Math.max(40, Math.round(height * 0.06));
    const fontSize = Math.max(14, Math.round(bannerH * 0.45));

    const bannerSvg = Buffer.from(`
      <svg width="${width}" height="${bannerH}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${bannerH}" fill="#1a1a2e" opacity="0.92"/>
        <text
          x="${width / 2}" y="${bannerH * 0.68}"
          font-family="Arial,sans-serif" font-size="${fontSize}"
          fill="white" text-anchor="middle"
        >⚠ Patient contact details are private — for medication reference only</text>
      </svg>
    `);

    return sharp(imageBuffer)
      .composite([{ input: bannerSvg, top: 0, left: 0 }])
      .jpeg({ quality: 88 })
      .toBuffer();
  }

  // ─── SERVER RESTART RECOVERY ─────────────────────────────────────────────────

  /**
   * Called once on server startup.
   * Re-arms timers for active broadcasts and immediately expires stale ones.
   * Uses the compound index { orderType, status, broadcastExpiry }.
   */
  static async recoverStaleBroadcasts() {
    const now = new Date();

    const activeBroadcasts = await Order.find({
      orderType: 'pharmacy',
      status: OrderStatus.PHARMACY_BROADCASTING,
    })
      .select('_id broadcastExpiry')
      .lean();

    if (activeBroadcasts.length === 0) {
      console.log('[PHARMACY] No active broadcasts to recover.');
      return;
    }

    console.log(`[PHARMACY] Recovering ${activeBroadcasts.length} broadcast(s) after restart.`);

    for (const order of activeBroadcasts) {
      const orderId = order._id.toString();
      const expiry = order.broadcastExpiry as Date | undefined;

      if (!expiry || expiry <= now) {
        // Already expired — process immediately
        console.log(`[PHARMACY] Expiring stale broadcast ${orderId}`);
        this.autoExpire(orderId).catch((err) =>
          console.error(`[PHARMACY] Recovery expire failed for ${orderId}:`, err)
        );
      } else {
        // Still within window — re-arm for remaining time
        const remaining = expiry.getTime() - now.getTime();
        console.log(
          `[PHARMACY] Re-arming timer for ${orderId} — ${Math.round(remaining / 1000)}s remaining`
        );
        this._armTimer(orderId, expiry);
      }
    }
  }

  // ─── SIGNED PRESCRIPTION URL ─────────────────────────────────────────────────

  /**
   * Generates a short-lived signed URL for the original prescription.
   * Only admin or the accepting seller (after order completes) can access.
   * Expires in 15 minutes.
   */
  static generateSignedPrescriptionUrl(originalUrl: string, expirySeconds = 900): string {
    try {
      const ik = getIK();
      // Extract the path from the full ImageKit URL
      const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT || '';
      const path = originalUrl.replace(urlEndpoint, '');
      return ik.url({
        path,
        signed: true,
        expireSeconds: expirySeconds,
      });
    } catch {
      return originalUrl; // graceful fallback
    }
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────────────────────────

  private static _armTimer(orderId: string, expiry: Date) {
    const remaining = expiry.getTime() - Date.now();
    if (remaining <= 0) {
      this.autoExpire(orderId).catch(console.error);
      return;
    }
    const timer = setTimeout(() => {
      this.autoExpire(orderId).catch((err) =>
        console.error(`[PHARMACY] autoExpire error for ${orderId}:`, err)
      );
    }, remaining);
    // Allow Node.js to exit cleanly even if timer is running
    if (timer.unref) timer.unref();
    broadcastTimers.set(orderId, timer);
  }

  private static _clearTimer(orderId: string) {
    const timer = broadcastTimers.get(orderId);
    if (timer) {
      clearTimeout(timer);
      broadcastTimers.delete(orderId);
    }
  }

  private static async _cancelNoZone(orderId: string) {
    await Order.findByIdAndUpdate(orderId, {
      $set: { status: OrderStatus.CANCELLED, cancellationReason: 'Location not in any service zone' },
    });
    const order = await Order.findById(orderId).select('buyer').lean();
    if (order?.buyer) {
      const buyerId = order.buyer.toString();
      await WalletService.refundToWallet(orderId);
      await NotificationService.send({
        recipient: buyerId,
        type: NotificationType.ORDER,
        title: 'Order Cancelled',
        message: 'We do not currently serve your area. Your payment has been refunded.',
        relatedId: orderId,
        data: { status: OrderStatus.CANCELLED, orderId },
      });
    }
  }

  private static async _cancelNoPharmacy(orderId: string) {
    await Order.findByIdAndUpdate(orderId, {
      $set: { status: OrderStatus.CANCELLED, cancellationReason: 'No pharmacy shops available in your area' },
    });
    const order = await Order.findById(orderId).select('buyer').lean();
    if (order?.buyer) {
      const buyerId = order.buyer.toString();
      await WalletService.refundToWallet(orderId);
      await NotificationService.send({
        recipient: buyerId,
        type: NotificationType.ORDER,
        title: 'No Pharmacy Available',
        message: 'There are no verified pharmacies in your area yet. Your payment has been refunded.',
        relatedId: orderId,
        data: { status: OrderStatus.CANCELLED, orderId },
      });
    }
  }
}
