import Razorpay from 'razorpay';
import crypto from 'crypto';
import { AppError } from '../utils/errors';

let razorpay: Razorpay | null = null;

function getClient(): Razorpay {
  if (!razorpay) {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) throw new AppError('Razorpay credentials not configured', 500);
    razorpay = new Razorpay({ key_id, key_secret });
  }
  return razorpay;
}

export class RazorpayService {
  static async createOrder(amount: number, receipt: string) {
    try {
      const order = await getClient().orders.create({
        amount: Math.round(amount * 100), // paise
        currency: 'INR',
        receipt,
      });
      return order;
    } catch (err: any) {
      throw new AppError(`Razorpay order creation failed: ${err.message}`, 500);
    }
  }

  static verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    const body = `${orderId}|${paymentId}`;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return expected === signature;
  }

  static verifyWebhook(body: string, signature: string): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return expected === signature;
  }
}
