import { Router } from 'express';
import { createShop, getShop, editShop, getMyShop } from '../controllers/shopController';
import { protect } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.post('/', protect, upload.single('logo'), createShop);
router.get('/my', protect, getMyShop);
router.get('/:id', getShop);
router.put('/:id', protect, upload.single('logo'), editShop);

export default router;
