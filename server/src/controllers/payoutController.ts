import { Request, Response } from 'express';
import { WalletService } from '../services/WalletService';
import { RazorpayService } from '../services/RazorpayService';
import { PayoutRequest } from '../models/PayoutRequest';
import { Shop } from '../models/Shop';
import { handleError, AppError } from '../utils/errors';
import { PayoutRequestStatus } from '@shared/types';
import { NotificationService } from '../services/notificationService';
import { NotificationType } from '../models/Notification';

// ─── USER ENDPOINTS ──────────────────────────────────────────────────────────

export const getWalletData = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const data = await WalletService.getWalletData(req.user?._id.toString()!, page, limit);
    res.json({ success: true, data });
  } catch (error) {
    handleError(error, res);
  }
};

export const requestPayout = async (req: Request, res: Response): Promise<void> => {
  try {
    const request = await WalletService.requestPayout(req.user?._id.toString()!, req.body);
    res.json({ success: true, data: request, message: 'Payout request submitted. We will process it within 2-3 business days.' });
  } catch (error) {
    handleError(error, res);
  }
};

export const getMyPayoutHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = await PayoutRequest.find({ user: req.user?._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({ success: true, data: requests });
  } catch (error) {
    handleError(error, res);
  }
};

// ─── ADMIN ENDPOINTS ─────────────────────────────────────────────────────────

export const getAllPayoutRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const filter: any = {};
    if (status) filter.status = status;

    const requests = await PayoutRequest.find(filter)
      .populate('user', 'name email walletBalance cashInHand role phoneNumber')
      .sort({ createdAt: -1 });

    const sellerIds = requests
      .filter((r) => ['seller', 'shop_owner'].includes((r.user as any)?.role))
      .map((r) => (r.user as any)?._id);

    const shops = await Shop.find({ owner: { $in: sellerIds } }).select('name owner').lean();

    const data = requests.map((r) => {
      const obj = r.toObject() as any;
      const userObj = obj.user;
      if (userObj && !userObj.name) {
        userObj.name = userObj.email?.split('@')[0] || userObj.phoneNumber || 'User';
      }
      const shop = shops.find((s) => s.owner?.toString() === userObj?._id?.toString());
      return { ...obj, shopName: shop?.name || null };
    });

    const stats = { pending: 0, processing: 0, completed: 0, rejected: 0, totalPendingAmount: 0 };
    requests.forEach((r) => {
      if (r.status === PayoutRequestStatus.PENDING) { stats.pending++; stats.totalPendingAmount += r.amount; }
      if (r.status === PayoutRequestStatus.PROCESSING) stats.processing++;
      if (r.status === PayoutRequestStatus.COMPLETED) stats.completed++;
      if (r.status === PayoutRequestStatus.REJECTED) stats.rejected++;
    });

    res.json({ success: true, data, stats });
  } catch (error) {
    handleError(error, res);
  }
};

export const updatePayoutStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, adminNote, utrNumber } = req.body;

    const request = await PayoutRequest.findById(id).populate('user', 'name email role');
    if (!request) throw new AppError('Payout request not found', 404);

    if (request.status === PayoutRequestStatus.COMPLETED) throw new AppError('Payout already completed.', 400);
    if (request.status === PayoutRequestStatus.REJECTED) throw new AppError('Payout already rejected.', 400);

    // REJECTED → revert wallet balance back to user
    if (status === PayoutRequestStatus.REJECTED) {
      await WalletService.revertPayout(id);
    }

    // COMPLETED → try Razorpay X automated payout; fall back to manual with UTR
    if (status === PayoutRequestStatus.COMPLETED) {
      if (!utrNumber) {
        const bankDetails = request.bankDetails;
        const rpResult = await RazorpayService.initiateRazorpayXPayout({
          accountNumber: bankDetails.accountNumber,
          ifscCode: bankDetails.ifscCode,
          holderName: bankDetails.holderName,
          amount: request.amount,
          narration: `Velto payout - ${(request.user as any)?.name || 'User'}`,
          reference: request._id.toString().slice(-8).toUpperCase(),
        });

        if (rpResult) {
          request.razorpayPayoutId = rpResult.payoutId;
        }
      } else {
        request.utrNumber = utrNumber;
      }
      request.processedAt = new Date();
    }

    request.status = status;
    if (adminNote) request.adminNote = adminNote;
    await request.save();

    const statusMessages: Record<string, string> = {
      [PayoutRequestStatus.COMPLETED]: `Your payout of ₹${request.amount} has been processed!${request.utrNumber ? ` UTR: ${request.utrNumber}` : ''}`,
      [PayoutRequestStatus.REJECTED]: `Your payout of ₹${request.amount} was rejected. ${adminNote || 'Contact support for details.'}`,
      [PayoutRequestStatus.PROCESSING]: `Your payout of ₹${request.amount} is being processed and will be transferred within 1-2 business days.`,
    };

    const msg = statusMessages[status];
    if (msg) {
      await NotificationService.send({
        recipient: (request.user as any)._id.toString(),
        type: NotificationType.PAYOUT,
        title: 'Payout Update',
        message: msg,
        relatedId: request._id.toString(),
      });
    }

    res.json({ success: true, data: request, message: `Payout updated to ${status}` });
  } catch (error) {
    handleError(error, res);
  }
};

// ─── PLATFORM REVENUE (Admin only) ───────────────────────────────────────────

export const getPlatformRevenue = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from as string) : undefined;
    const toDate = to ? new Date(to as string) : undefined;
    const summary = await WalletService.getPlatformRevenueSummary(fromDate, toDate);
    res.json({ success: true, data: summary });
  } catch (error) {
    handleError(error, res);
  }
};
