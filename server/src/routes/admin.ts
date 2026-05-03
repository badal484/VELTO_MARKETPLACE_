import { Router } from 'express';
import { 
  getPendingShops, getAllShops, approveShop, rejectShop,
  getUsers, deleteUser, getProducts, deleteProduct, getStats,
  getAllOrders, verifyRider, rejectRider, toggleUserBlock, forceReleaseOrder,
  verifyPayment, updateOrderStatus, getAllTransactions
} from '../controllers/adminController';
import { protect } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { recordCashDeposit } from '../controllers/cashSettlementController';

const router = Router();

router.use(protect, requireAdmin);

router.post('/cash-settlement', recordCashDeposit);
router.get('/shops/pending', getPendingShops);
router.get('/shops/all', getAllShops);
router.patch('/shops/:id/approve', approveShop);
router.patch('/shops/:id/reject', rejectShop);

router.get('/users', getUsers);
router.delete('/users/:id', deleteUser);
router.patch('/users/:id/toggle-block', toggleUserBlock);
router.patch('/users/:id/verify-rider', verifyRider);
router.patch('/users/:id/reject-rider', rejectRider);

router.get('/products', getProducts);
router.delete('/products/:id', deleteProduct);

router.get('/stats', getStats);
router.get('/orders/all', getAllOrders);
router.patch('/orders/:id/status', updateOrderStatus);
router.post('/orders/:id/release', forceReleaseOrder);
router.patch('/verify-payment/:id', verifyPayment);
router.get('/transactions', getAllTransactions);

export default router;