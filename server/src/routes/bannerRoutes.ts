import { Router } from 'express';
import { 
  getBanners, 
  getAdminBanners, 
  createBanner, 
  toggleBannerStatus, 
  deleteBanner 
} from '../controllers/bannerController';
import { protect } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public Routes
router.get('/', getBanners);

// Admin Routes
router.use(protect, requireAdmin);
router.get('/admin', getAdminBanners);
router.post('/', upload.single('image'), createBanner);
router.patch('/:id/toggle', toggleBannerStatus);
router.delete('/:id', deleteBanner);

export default router;