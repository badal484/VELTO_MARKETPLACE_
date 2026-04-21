import { Request, Response } from 'express';
import { User } from '../models/User';
import { WalletTransaction } from '../models/WalletTransaction';
import { AppError, handleError } from '../utils/errors';
import mongoose from 'mongoose';
import { io } from '../socket/socket';
import { SocketEvent } from '@shared/constants/socketEvents';

/**
 * Controller for Admin to manage physical cash settlements from delivery riders.
 */
export const recordCashDeposit = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { riderId, amount, reference } = req.body;

    if (!riderId || !amount || amount <= 0) {
      throw new AppError('Invalid rider ID or settlement amount', 400);
    }

    const rider = await User.findById(riderId).session(session);
    if (!rider) throw new AppError('Rider not found', 404);

    const actualAmount = Math.min(amount, rider.cashInHand || 0);

    // 1. Reduce the Rider's cash liability
    await User.findByIdAndUpdate(
      riderId,
      { $inc: { cashInHand: -actualAmount } },
      { session }
    );

    // 2. Record the transaction for audit
    await WalletTransaction.create([{
      user: riderId,
      amount: actualAmount,
      type: 'debit', // Using debit to represent "Clearing a liability"
      description: `Cash Settlement: ${reference || 'Physical Deposit at Office'}`,
      createdAt: new Date()
    }], { session });

    await session.commitTransaction();

    // 3. Real-time update for the Rider's wallet screen
    const updatedRider = await User.findById(riderId).select('walletBalance cashInHand');
    io.to(riderId.toString()).emit(SocketEvent.WALLET_UPDATED, { 
       balance: updatedRider?.walletBalance || 0,
       cashInHand: updatedRider?.cashInHand || 0
    });

    res.json({
      success: true,
      message: `Successfully recorded ₹${actualAmount} cash deposit for ${rider.name}.`,
      data: {
        newCashInHand: updatedRider?.cashInHand || 0
      }
    });

  } catch (error) {
    await session.abortTransaction();
    handleError(error, res);
  } finally {
    session.endSession();
  }
};