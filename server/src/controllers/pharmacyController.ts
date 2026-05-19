import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { Shop } from '../models/Shop';
import { PharmacyCatalog } from '../models/PharmacyCatalog';
import { PharmacyService } from '../services/pharmacyService';
import { WalletService } from '../services/WalletService';
import { NotificationService } from '../services/notificationService';
import { NotificationType } from '../models/Notification';
import { handleError, AppError } from '../utils/errors';
import { OrderStatus, Role, Category } from '@shared/types';
import { z } from 'zod';

// ── Zod schemas ───────────────────────────────────────────────────────────────

const catalogItemSchema = z.object({
  catalogItemId: z.string().min(1),
  quantity: z.number().int().min(1).max(50),
});

const createPharmacyOrderSchema = z.object({
  items: z.array(catalogItemSchema).min(1, 'At least one item required').max(20),
  paymentMethod: z.enum(['Cash on Delivery', 'Cash on Pickup', 'Razorpay', 'Direct UPI Transfer']),
  buyerPhone: z.string().min(10, 'Valid phone number required'),
  deliveryAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    pincode: z.string().min(6).max(6),
    landmark: z.string().optional(),
  }),
  deliveryCharge: z.number().nonnegative().default(0),
  walletAmountToUse: z.number().nonnegative().default(0),
  prescriptionConsent: z.boolean().default(false),
  lat: z.number(),
  lng: z.number(),
});

// ── BUYER ENDPOINTS ───────────────────────────────────────────────────────────

export const searchCatalog = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = (req.query.q as string) || '';
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const items = await PharmacyService.searchCatalog(query, limit);
    res.json({ success: true, data: items });
  } catch (error) {
    handleError(error, res);
  }
};

export const getCatalogItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const item = await PharmacyService.getCatalogItem(req.params.id);
    res.json({ success: true, data: item });
  } catch (error) {
    handleError(error, res);
  }
};

/**
 * Creates a pharmacy order.
 * Validates each catalog item exists and is active.
 * If any item requires a prescription, checks that consent was given
 * and a prescription image was uploaded.
 * Triggers broadcast immediately for COD orders; waits for payment for Razorpay.
 */
export const createPharmacyOrder = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Multer formData stores everything as strings, we need to preprocess JSON and number/boolean fields
    if (typeof req.body.items === 'string') {
      try { req.body.items = JSON.parse(req.body.items); } catch(e) {}
    }
    if (typeof req.body.deliveryAddress === 'string') {
      try { req.body.deliveryAddress = JSON.parse(req.body.deliveryAddress); } catch(e) {}
    }
    if (typeof req.body.deliveryCharge === 'string') req.body.deliveryCharge = Number(req.body.deliveryCharge);
    if (typeof req.body.walletAmountToUse === 'string') req.body.walletAmountToUse = Number(req.body.walletAmountToUse);
    if (typeof req.body.lat === 'string') req.body.lat = Number(req.body.lat);
    if (typeof req.body.lng === 'string') req.body.lng = Number(req.body.lng);
    if (typeof req.body.prescriptionConsent === 'string') req.body.prescriptionConsent = req.body.prescriptionConsent === 'true';

    const parsed = createPharmacyOrderSchema.parse(req.body);
    const buyerId = req.user!._id.toString();

    // Validate catalog items exist + are active
    const catalogDocs = await PharmacyCatalog.find({
      _id: { $in: parsed.items.map((i) => i.catalogItemId) },
      isActive: true,
    }).lean();

    if (catalogDocs.length !== parsed.items.length) {
      const foundIds = new Set(catalogDocs.map((d) => d._id.toString()));
      const missing = parsed.items
        .filter((i) => !foundIds.has(i.catalogItemId))
        .map((i) => i.catalogItemId);
      throw new AppError(`Some items not found or inactive: ${missing.join(', ')}`, 400);
    }

    // Check prescription requirement
    const needsPrescription = catalogDocs.some((d) => d.requiresPrescription);
    const prescriptionFile = req.file; // multer single file

    if (needsPrescription && !prescriptionFile) {
      throw new AppError(
        'One or more items require a valid prescription. Please upload a prescription image.',
        400
      );
    }

    if (needsPrescription && !parsed.prescriptionConsent) {
      throw new AppError(
        'You must consent to sharing your prescription with the pharmacist.',
        400
      );
    }

    // Build catalog items snapshot with MRP at order time
    const catalogItemsById = new Map(catalogDocs.map((d) => [d._id.toString(), d]));
    const catalogItems = parsed.items.map((item) => {
      const doc = catalogItemsById.get(item.catalogItemId)!;
      return {
        catalogItem: doc._id,
        name: doc.name,
        mrp: doc.mrp,
        quantity: item.quantity,
      };
    });

    // Total = sum of (MRP × qty) for all items
    const itemsTotal = catalogItems.reduce((sum, i) => sum + i.mrp * i.quantity, 0);
    const totalPrice = itemsTotal; // delivery charge added separately

    // Wallet deduction (partial or full) — cannot exceed items total
    const { walletAmountToUse: requestedWallet } = parsed;
    const buyer = await require('../models/User').User.findById(buyerId)
      .select('walletBalance')
      .session(session);
    const walletBalance = (buyer?.walletBalance as number) || 0;
    const walletAmountPaid = Math.min(requestedWallet, walletBalance, totalPrice);

    // Process prescription if present
    let prescriptionImageUrl: string | undefined;
    let prescriptionRedactedUrl: string | undefined;

    if (prescriptionFile) {
      try {
        const result = await PharmacyService.processPrescription(prescriptionFile.buffer);
        prescriptionImageUrl = result.originalUrl;
        prescriptionRedactedUrl = result.redactedUrl;
      } catch (uploadErr) {
        console.error('[PHARMACY] Prescription upload failed:', uploadErr);
        throw new AppError('Failed to upload prescription. Please try again.', 500);
      }
    }

    // Determine initial status based on payment method
    // COD / Direct UPI Transfer → go straight to PHARMACY_BROADCASTING
    // Razorpay → PENDING until payment webhook confirms
    const initialStatus =
      parsed.paymentMethod === 'Razorpay'
        ? OrderStatus.PENDING
        : OrderStatus.PHARMACY_BROADCASTING;

    const [order] = await Order.create(
      [
        {
          buyer: buyerId,
          orderType: 'pharmacy',
          catalogItems,
          quantity: 1, // pharmacy orders don't use this field; set to 1 as placeholder
          totalPrice,
          deliveryCharge: parsed.deliveryCharge,
          walletAmountPaid,
          paymentMethod: parsed.paymentMethod,
          fulfillmentMethod: 'delivery',
          deliveryAddress: parsed.deliveryAddress,
          buyerPhone: parsed.buyerPhone,
          status: initialStatus,
          pickupLocation: {
            type: 'Point',
            coordinates: [parsed.lng, parsed.lat],
          },
          deliveryLocation: {
            type: 'Point',
            coordinates: [parsed.lng, parsed.lat],
          },
          prescriptionImageUrl,
          prescriptionRedactedUrl,
          prescriptionConsent: parsed.prescriptionConsent,
        },
      ],
      { session }
    );

    // Deduct wallet balance if used
    if (walletAmountPaid > 0) {
      await require('../models/User').User.findByIdAndUpdate(
        buyerId,
        { $inc: { walletBalance: -walletAmountPaid } },
        { session }
      );
    }

    await session.commitTransaction();

    // Trigger broadcast for non-Razorpay orders immediately
    if (initialStatus === OrderStatus.PHARMACY_BROADCASTING) {
      setImmediate(() => {
        PharmacyService.broadcast(order._id.toString(), [parsed.lng, parsed.lat]).catch((err) =>
          console.error('[PHARMACY] Broadcast failed for order', order._id, err)
        );
      });
    }

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    handleError(error, res);
  } finally {
    session.endSession();
  }
};

/**
 * Called by the Razorpay payment webhook handler (or manual trigger) to
 * kick off broadcast after payment is confirmed.
 */
export const triggerBroadcastAfterPayment = async (orderId: string): Promise<void> => {
  const order = await Order.findById(orderId).lean();
  if (!order || order.orderType !== 'pharmacy') return;
  if (order.status !== OrderStatus.PENDING) return;

  await Order.findByIdAndUpdate(orderId, {
    $set: { status: OrderStatus.PHARMACY_BROADCASTING },
  });

  const coords = order.pickupLocation?.coordinates as [number, number] | undefined;
  if (coords) {
    await PharmacyService.broadcast(orderId, coords);
  }
};

// ── SELLER (PHARMACY SHOP) ENDPOINTS ─────────────────────────────────────────

/**
 * Returns all active broadcast orders for this pharmacy shop owner.
 * Only orders whose broadcastedTo includes this shop AND are still broadcasting.
 */
export const getActiveBroadcasts = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();

    // Find the pharmacy shop belonging to this seller
    const shop = await Shop.findOne({
      owner: userId,
      category: Category.PHARMACY,
      isVerified: true,
    })
      .select('_id')
      .lean();

    if (!shop) throw new AppError('No verified pharmacy shop found for your account', 404);

    const now = new Date();
    const broadcasts = await Order.find({
      orderType: 'pharmacy',
      status: OrderStatus.PHARMACY_BROADCASTING,
      broadcastedTo: shop._id,
      broadcastExpiry: { $gt: now },
    })
      .select(
        'catalogItems totalPrice deliveryCharge prescriptionRedactedUrl broadcastExpiry createdAt'
      )
      .populate('catalogItems.catalogItem', 'name strength form image')
      .lean();

    // Compute remaining seconds for each — useful for countdown timers
    const withCountdown = broadcasts.map((o) => ({
      ...o,
      secondsRemaining: o.broadcastExpiry
        ? Math.max(0, Math.floor((new Date(o.broadcastExpiry).getTime() - now.getTime()) / 1000))
        : 0,
    }));

    res.json({ success: true, data: withCountdown });
  } catch (error) {
    handleError(error, res);
  }
};

/**
 * Pharmacy shop accepts a broadcast order.
 */
export const acceptBroadcast = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: orderId } = req.params;
    const userId = req.user!._id.toString();

    const shop = await Shop.findOne({
      owner: userId,
      category: Category.PHARMACY,
      isVerified: true,
    })
      .select('_id')
      .lean();

    if (!shop) throw new AppError('No verified pharmacy shop found for your account', 404);

    const order = await PharmacyService.acceptOrder(orderId, shop._id.toString());
    res.json({ success: true, data: order });
  } catch (error) {
    handleError(error, res);
  }
};

/**
 * Returns pharmacy orders accepted by this seller's shop.
 * Buyer phone and address are stripped — never exposed to seller.
 */
export const getMyPharmacyOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const shop = await Shop.findOne({ owner: userId, category: Category.PHARMACY })
      .select('_id')
      .lean();

    if (!shop) {
      res.json({ success: true, data: [] });
      return;
    }

    const orders = await Order.find({
      orderType: 'pharmacy',
      shop: shop._id,
      status: { $nin: [OrderStatus.PHARMACY_BROADCASTING, OrderStatus.PAYMENT_UNDER_REVIEW] },
    })
      .select(
        '-buyerPhone -deliveryAddress -prescriptionImageUrl' // never expose these to seller
      )
      .populate('catalogItems.catalogItem', 'name strength form')
      .populate('rider', 'name avatar phoneNumber')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Attach redacted prescription URL (pharmacist may need to see medicines)
    // but never the original or buyer contact details
    res.json({ success: true, data: orders });
  } catch (error) {
    handleError(error, res);
  }
};

/**
 * Generates a short-lived signed URL for the ORIGINAL prescription.
 * Accessible only by admin role or the seller after order is confirmed.
 * Expires in 15 minutes.
 */
export const getPrescriptionUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: orderId } = req.params;
    const userId = req.user!._id.toString();
    const userRole = req.user!.role as Role;

    const order = await Order.findById(orderId)
      .select('orderType seller shop prescriptionImageUrl status buyer')
      .lean();

    if (!order) throw new AppError('Order not found', 404);
    if (order.orderType !== 'pharmacy') throw new AppError('Not a pharmacy order', 400);

    const isAdmin = userRole === Role.ADMIN;
    const isBuyer = order.buyer?.toString() === userId;

    // Seller can access only after their shop accepted (seller field set) and order is active
    const isSeller = order.seller?.toString() === userId;
    const sellerCanAccess =
      isSeller &&
      ![OrderStatus.CANCELLED, OrderStatus.COMPLETED].includes(order.status as OrderStatus);

    if (!isAdmin && !isBuyer && !sellerCanAccess) {
      throw new AppError('You do not have permission to view this prescription', 403);
    }

    if (!order.prescriptionImageUrl) {
      throw new AppError('No prescription on file for this order', 404);
    }

    const signedUrl = PharmacyService.generateSignedPrescriptionUrl(
      order.prescriptionImageUrl,
      900 // 15 minutes
    );

    res.json({ success: true, data: { url: signedUrl, expiresInSeconds: 900 } });
  } catch (error) {
    handleError(error, res);
  }
};

// ── ADMIN ENDPOINTS ──────────────────────────────────────────────────────────

export const adminListCatalog = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const query = (req.query.q as string) || '';
    const onlyRx = req.query.rx === 'true';

    const filter: any = {};
    if (query) filter.$text = { $search: query };
    if (onlyRx) filter.requiresPrescription = true;

    const [items, total] = await Promise.all([
      PharmacyCatalog.find(filter)
        .sort(query ? { score: { $meta: 'textScore' } } : { name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PharmacyCatalog.countDocuments(filter),
    ]);

    res.json({ success: true, data: items, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    handleError(error, res);
  }
};

export const adminAddCatalogItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const item = await PharmacyCatalog.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    handleError(error, res);
  }
};

export const adminUpdateCatalogItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const item = await PharmacyCatalog.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!item) throw new AppError('Catalog item not found', 404);
    res.json({ success: true, data: item });
  } catch (error) {
    handleError(error, res);
  }
};

export const adminToggleCatalogItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const item = await PharmacyCatalog.findById(req.params.id);
    if (!item) throw new AppError('Catalog item not found', 404);
    item.isActive = !item.isActive;
    await item.save();
    res.json({ success: true, data: item, message: `Item ${item.isActive ? 'activated' : 'deactivated'}` });
  } catch (error) {
    handleError(error, res);
  }
};

export const adminDeleteCatalogItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const item = await PharmacyCatalog.findByIdAndDelete(req.params.id);
    if (!item) throw new AppError('Catalog item not found', 404);
    res.json({ success: true, message: 'Catalog item removed' });
  } catch (error) {
    handleError(error, res);
  }
};

/**
 * Admin: list all pharmacy orders (all statuses, all shops).
 * Used in admin dashboard for monitoring and support.
 */
export const adminListPharmacyOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const status = req.query.status as string | undefined;

    const filter: any = { orderType: 'pharmacy' };
    if (status) filter.status = status;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('buyer', 'name phoneNumber avatar')
        .populate('shop', 'name contactInfo')
        .populate('seller', 'name')
        .populate('catalogItems.catalogItem', 'name strength form')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.json({ success: true, data: orders, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    handleError(error, res);
  }
};
