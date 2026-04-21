import { Router } from 'express';
import {
  getRiderOrders,
  createBatchOrder,
  createOrder,
  getMyOrders,
  getOrderById,
  getSellerOrders,
  updateOrderStatus,
  verifyOrderOTP,
  getAvailableJobs,
  claimOrder,
  verifyDeliveryOTP,
  releaseOrder
} from '../controllers/orderController';
import { generateInvoice } from '../controllers/invoiceController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

router.post('/', createOrder);
router.post('/batch', createBatchOrder);

// Specific string routes must come before /:id to avoid interception
router.get('/my', getMyOrders);
router.get('/seller', getSellerOrders);
router.get('/jobs/available', getAvailableJobs);
router.get('/rider', getRiderOrders);

// Parameterised routes
router.get('/:id', getOrderById);
router.get('/:id/invoice', generateInvoice);
router.patch('/:id/status', updateOrderStatus);
router.post('/:id/verify-otp', verifyOrderOTP);
router.patch('/:id/claim', claimOrder);
router.post('/:id/release', releaseOrder);
router.post('/:id/verify-delivery', verifyDeliveryOTP);

export default router;