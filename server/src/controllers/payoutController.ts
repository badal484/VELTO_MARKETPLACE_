import { Request, Response } from 'express';
import { WalletService } from '../services/WalletService';
import { PayoutRequest } from '../models/PayoutRequest';
import { User } from '../models/User';
import { handleError, AppError } from '../utils/errors';
import { PayoutRequestStatus } from '@shared/types';

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
    const requests = await PayoutRequest.find()
      .populate('rider', 'name email walletBalance')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
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
    res.json({ success: true, data: request, message: `Payout status updated to ${status}` });
  } catch (error) {
    handleError(error, res);
  }
};