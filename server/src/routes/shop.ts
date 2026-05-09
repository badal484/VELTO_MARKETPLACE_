import { Router } from 'express';
import { createShop, getShop, editShop, getMyShop } from '../controllers/shopController';
import { protect } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.post('/', protect, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }]), createShop);
router.get('/my', protect, getMyShop);
router.get('/:id', getShop);
router.put('/:id', protect, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }]), editShop);

export default router;
