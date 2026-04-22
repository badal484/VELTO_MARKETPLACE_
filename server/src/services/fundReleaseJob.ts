import { Order } from '../models/Order';
import { OrderStatus } from '@shared/types';
import { WalletService } from './WalletService';

const RELEASE_DELAY_MS = 48 * 60 * 60 * 1000; // 48 hours after delivery
const POLL_INTERVAL_MS = 30 * 60 * 1000; // check every 30 minutes

export class FundReleaseJob {
  static init() {
    console.log('[FundReleaseJob] Started');
    FundReleaseJob.run();
    setInterval(FundReleaseJob.run, POLL_INTERVAL_MS);
  }

  static async run() {
    try {
      const cutoff = new Date(Date.now() - RELEASE_DELAY_MS);
      const orders = await Order.find({
        status: OrderStatus.COMPLETED_PENDING_RELEASE,
        deliveredAt: { $lte: cutoff },
      }).select('_id');

      for (const order of orders) {
        try {
          await WalletService.creditSellerEarnings(order._id.toString());
          await Order.findByIdAndUpdate(order._id, { status: OrderStatus.COMPLETED });
          console.log(`[FundReleaseJob] Released funds for order ${order._id}`);
        } catch (err) {
          console.error(`[FundReleaseJob] Failed for order ${order._id}:`, err);
        }
      }
    } catch (err) {
      console.error('[FundReleaseJob] Run failed:', err);
    }
  }
}
