import { Router } from 'express';
import { verifyPayment, handleWebhook } from '../controllers/paymentController';
import { protect } from '../middleware/auth';

const router = Router();

// Endpoint for the client to verify payment after Razorpay checkout
router.post('/verify', protect, verifyPayment);

// Public webhook endpoint for Razorpay to send payment notifications
router.post('/webhook', handleWebhook);

export default router;
