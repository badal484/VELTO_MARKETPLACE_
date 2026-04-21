import { Router } from 'express';
import { 
  getCart, 
  addToCart, 
  updateCartItem, 
  removeFromCart, 
  clearCart 
} from '../controllers/cartController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

router.get('/', getCart);
router.post('/add', addToCart);
router.put('/update', updateCartItem);
router.delete('/:productId', removeFromCart);
router.post('/remove', removeFromCart); // Legacy fallback for older app builds
router.delete('/clear', clearCart);

export default router;
