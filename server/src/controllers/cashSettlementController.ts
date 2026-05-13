import { Request, Response } from 'express';
import { User } from '../models/User';
import { WalletTransaction } from '../models/WalletTransaction';
import { AppError, handleError } from '../utils/errors';
import mongoose from 'mongoose';
import { io } from '../socket/socket';
import { SocketEvent } from '@shared/constants/socketEvents';
import { TransactionCategory } from '@shared/types';

/**
 * Admin endpoint to record physical cash deposits from COD riders.
 * Reduces the rider's cashInHand liability by the deposited amount.
 */
export const recordCashDeposit = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { riderId, amount, reference } = req.body;

    if (!riderId || !amount || Number(amount) <= 0) {
      throw new AppError('Invalid rider ID or settlement amount', 400);
    }

    const rider = await User.findById(riderId).session(session);
    if (!rider) throw new AppError('Rider not found', 404);

    const currentLiability = rider.cashInHand || 0;
    if (currentLiability <= 0) {
      throw new AppError(`Rider has no outstanding COD liability (cashInHand = ₹${currentLiability})`, 400);
    }

    // Cap deposit at actual liability so we can't over-settle
    const settledAmount = Math.min(Number(amount), currentLiability);

    await User.findByIdAndUpdate(riderId, { $inc: { cashInHand: -settledAmount } }, { session });

    await WalletTransaction.create([{
      user: riderId,
      amount: settledAmount,
      type: 'debit',
      category: TransactionCategory.CASH_SETTLEMENT,
      description: `Cash deposit settled: ₹${settledAmount}${reference ? ` — Ref: ${reference}` : ' — Physical deposit at office'}`,
    }], { session });

    await session.commitTransaction();

    const updatedRider = await User.findById(riderId).select('walletBalance cashInHand').lean();
    io.to(riderId.toString()).emit(SocketEvent.WALLET_UPDATED, {
      balance: updatedRider?.walletBalance || 0,
      cashInHand: updatedRider?.cashInHand || 0,
    });

    res.json({
      success: true,
      message: `Recorded ₹${settledAmount} cash deposit for ${rider.name}.`,
      data: {
        settledAmount,
        remainingCashInHand: updatedRider?.cashInHand || 0,
      },
    });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    handleError(error, res);
  } finally {
    session.endSession();
  }
};
