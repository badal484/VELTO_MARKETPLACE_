import express from 'express';
import { protect } from '../middleware/auth';
import { 
  updateAvatar,
  updateProfile,
  addAddress,
  deleteAddress,
  registerRider,
  toggleOnlineStatus
} from '../controllers/userController';
import { upload } from '../middleware/upload';
import { validateRequest } from '../middleware/validateRequest';
import { updateProfileSchema, addressSchema, riderRegisterSchema } from '../utils/validation';

const router = express.Router();

router.use(protect); // All user routes require authentication


router.patch('/profile', validateRequest(updateProfileSchema), updateProfile);
router.patch('/avatar', upload.single('avatar'), updateAvatar);
router.post('/addresses', validateRequest(addressSchema), addAddress);
router.delete('/addresses/:id', deleteAddress);
router.post('/register-rider', validateRequest(riderRegisterSchema), registerRider);
router.patch('/toggle-online', toggleOnlineStatus);

export default router;
