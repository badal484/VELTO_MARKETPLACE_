import { Request, Response } from 'express';
import { WalletService } from '../services/WalletService';
import { PayoutRequest } from '../models/PayoutRequest';
import { User } from '../models/User';
import { Shop } from '../models/Shop';
import { handleError, AppError } from '../utils/errors';
import { PayoutRequestStatus } from '@shared/types';
import { NotificationService } from '../services/notificationService';
import { NotificationType } from '../models/Notification';

export const getWalletData = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await WalletService.getWalletData(req.user?._id.toString()!);
    res.json({ success: true, data });
  } catch (error) {
    handleError(error, res);
  }
};

export const requestPayout = async (req: Request, res: Response): Promise<void> => {
  try {
    const request = await WalletService.requestPayout(req.user?._id.toString()!, req.body);
    res.json({ success: true, data: request, message: 'Payout request submitted successfully' });
  } catch (error) {
    handleError(error, res);
  }
};

// Admin Endpoints
export const getAllPayoutRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Fetch Payouts with User Info
    const requests = await PayoutRequest.find()
      .populate('rider', 'name email walletBalance role phoneNumber')
      .sort({ createdAt: -1 });

    // 2. Fetch associated Shops for Sellers
    const sellerIds = requests
      .filter(r => (r.rider as any)?.role === 'seller' || (r.rider as any)?.role === 'shop_owner')
      .map(r => (r.rider as any)._id);
    
    const shops = await Shop.find({ owner: { $in: sellerIds } }).select('name owner businessName');

    const data = requests.map(r => {
      const obj = r.toObject();
      const riderObj = obj.rider as any;
      
      // Force populate name if missing but email exists
      if (riderObj && !riderObj.name) {
        riderObj.name = riderObj.email?.split('@')[0] || riderObj.phoneNumber || 'User';
      }
      
      const shop = shops.find(s => s.owner && riderObj && s.owner.toString() === riderObj._id.toString());
      return { ...obj, shopName: shop ? shop.name : null };
    });

    // 3. Aggregate Stats
    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      totalPendingAmount: 0
    };

    requests.forEach(r => {
      if (r.status === PayoutRequestStatus.PENDING) {
        stats.pending++;
        stats.totalPendingAmount += r.amount;
      }
      if (r.status === PayoutRequestStatus.PROCESSING) stats.processing++;
      if (r.status === PayoutRequestStatus.COMPLETED) stats.completed++;
    });

    res.json({ success: true, data, stats });
  } catch (error) {
    handleError(error, res);
  }
};

export const updatePayoutStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, adminNote, transactionId } = req.body;

    const request = await PayoutRequest.findById(id);
    if (!request) throw new AppError('Request not found', 404);

    if (request.status === PayoutRequestStatus.COMPLETED) {
      throw new AppError('Payout already completed', 400);
    }

    request.status = status;
    if (adminNote) request.adminNote = adminNote;
    if (transactionId) request.transactionId = transactionId;
    if (status === PayoutRequestStatus.COMPLETED) {
      request.processedAt = new Date();
    }
    
    // If rejected, refund the rider's wallet using WalletService (creates audit trail)
    if (status === PayoutRequestStatus.REJECTED) {
      await WalletService.revertPayout(id);
    }

    await request.save();
    
    // Re-populate to maintain UI consistency on frontend
    await request.populate('rider', 'name email walletBalance role phoneNumber');

    // 📬 Notify User of Status Change 📬
    const statusMsg = status === PayoutRequestStatus.COMPLETED 
      ? `Your payout of ₹${request.amount} has been successfully processed!`
      : status === PayoutRequestStatus.REJECTED
      ? `Your payout request was rejected. ${adminNote || 'Contact support for details.'}`
      : `Your payout of ₹${request.amount} is now being processed.`;

    await NotificationService.send({
      recipient: (request.rider as any)._id.toString(),
      type: NotificationType.PAYOUT,
      title: 'Payout Update',
      message: statusMsg,
      relatedId: request._id.toString(),
    });

    res.json({ success: true, data: request, message: `Payout status updated to ${status}` });
  } catch (error) {
    handleError(error, res);
  }
};