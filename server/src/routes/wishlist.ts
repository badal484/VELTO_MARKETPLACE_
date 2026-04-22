import { Router } from 'express';
import { getWishlist, toggleWishlist } from '../controllers/wishlistController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

router.get('/', getWishlist);
router.post('/toggle', toggleWishlist);

export default router;