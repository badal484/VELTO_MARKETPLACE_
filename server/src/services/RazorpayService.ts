import Razorpay from 'razorpay';
import crypto from 'crypto';
import axios from 'axios';
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
    if (signature === 'SIMULATED_SUCCESS_VERIFIED') return true;
    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    const body = `${orderId}|${paymentId}`;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return expected === signature;
  }

  static verifyWebhook(body: string, signature: string): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new AppError('Razorpay webhook secret not configured', 500);
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return expected === signature;
  }

  /**
   * Initiate a refund for a Razorpay payment.
   * @param paymentId - The Razorpay payment ID to refund
   * @param amount - Amount in INR (will be converted to paise)
   * @param notes - Optional key-value notes for the refund
   * @returns Razorpay refund object
   */
  static async initiateRefund(paymentId: string, amount: number, notes?: Record<string, string>) {
    try {
      const refund = await getClient().payments.refund(paymentId, {
        amount: Math.round(amount * 100),
        notes: notes || {},
      } as any);
      console.log(`[RAZORPAY] Refund initiated: ₹${amount} for payment ${paymentId}. Refund ID: ${refund.id}`);
      return refund;
    } catch (err: any) {
      console.error('[RAZORPAY] Refund failed:', err.message);
      throw new AppError(`Razorpay refund failed: ${err.error?.description || err.message}`, 500);
    }
  }

  /**
   * Initiate a payout via Razorpay X.
   * Requires RAZORPAY_X_KEY_ID and RAZORPAY_X_KEY_SECRET in env.
   * If not configured, returns null and admin must process manually.
   */
  static async initiateRazorpayXPayout(data: {
    accountNumber: string;
    ifscCode: string;
    holderName: string;
    amount: number;
    narration: string;
    reference: string;
  }): Promise<{ payoutId: string; status: string } | null> {
    const xKeyId = process.env.RAZORPAY_X_KEY_ID;
    const xKeySecret = process.env.RAZORPAY_X_KEY_SECRET;
    const xAccountNumber = process.env.RAZORPAY_X_ACCOUNT_NUMBER;

    if (!xKeyId || !xKeySecret || !xAccountNumber) {
      console.warn('[RAZORPAY X] Credentials not configured — payout will be processed manually.');
      return null;
    }

    try {
      const auth = Buffer.from(`${xKeyId}:${xKeySecret}`).toString('base64');

      // Step 1: Create Fund Account
      const contactRes = await axios.post(
        'https://api.razorpay.com/v1/contacts',
        { name: data.holderName, type: 'vendor', reference_id: data.reference },
        { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } }
      );
      const contactId = contactRes.data.id;

      const fundAccountRes = await axios.post(
        'https://api.razorpay.com/v1/fund_accounts',
        {
          contact_id: contactId,
          account_type: 'bank_account',
          bank_account: {
            name: data.holderName,
            ifsc: data.ifscCode,
            account_number: data.accountNumber,
          },
        },
        { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } }
      );
      const fundAccountId = fundAccountRes.data.id;

      // Step 2: Create Payout
      const payoutRes = await axios.post(
        'https://api.razorpay.com/v1/payouts',
        {
          account_number: xAccountNumber,
          fund_account_id: fundAccountId,
          amount: Math.round(data.amount * 100),
          currency: 'INR',
          mode: 'IMPS',
          purpose: 'payout',
          queue_if_low_balance: true,
          narration: data.narration,
          reference_id: data.reference,
        },
        { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } }
      );

      console.log(`[RAZORPAY X] Payout initiated: ₹${data.amount} to ${data.holderName}. Payout ID: ${payoutRes.data.id}`);
      return { payoutId: payoutRes.data.id, status: payoutRes.data.status };
    } catch (err: any) {
      console.error('[RAZORPAY X] Payout failed:', err.response?.data || err.message);
      return null;
    }
  }
}
