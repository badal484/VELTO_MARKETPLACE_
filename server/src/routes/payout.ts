import express from 'express';
import { protect } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { 
  getWalletData, 
  requestPayout, 
  getAllPayoutRequests, 
  updatePayoutStatus 
} from '../controllers/payoutController';

const router = express.Router();

// Rider Endpoints
router.get('/wallet', protect, getWalletData);
router.post('/request', protect, requestPayout);

// Admin Endpoints
router.get('/admin/all', protect, requireAdmin, getAllPayoutRequests);
router.patch('/admin/:id', protect, requireAdmin, updatePayoutStatus);

export default router;