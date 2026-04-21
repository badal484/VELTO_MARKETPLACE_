import express from 'express';
import { protect } from '../middleware/auth';
import { 
  updateAvatar,
  updateProfile,
  addAddress,
  deleteAddress,
  getAdminContact,
  registerRider
} from '../controllers/userController';
import { upload } from '../middleware/upload';

const router = express.Router();

router.use(protect); // All user routes require authentication

router.get('/admin-contact', getAdminContact);
router.patch('/profile', updateProfile);
router.patch('/avatar', upload.single('avatar'), updateAvatar);
router.post('/addresses', addAddress);
router.delete('/addresses/:id', deleteAddress);
router.post('/register-rider', registerRider);

export default router;
