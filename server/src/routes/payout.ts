import express from 'express';
import { protect } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import {
  getWalletData,
  requestPayout,
  getMyPayoutHistory,
  getAllPayoutRequests,
  updatePayoutStatus,
  getPlatformRevenue,
} from '../controllers/payoutController';

const router = express.Router();

// User endpoints (riders, sellers, buyers)
router.get('/wallet', protect, getWalletData);
router.post('/request', protect, requestPayout);
router.get('/my-requests', protect, getMyPayoutHistory);

// Admin endpoints — order matters: specific routes before :id param
router.get('/admin/revenue', protect, requireAdmin, getPlatformRevenue);
router.get('/admin/all', protect, requireAdmin, getAllPayoutRequests);
router.patch('/admin/:id', protect, requireAdmin, updatePayoutStatus);

export default router;
