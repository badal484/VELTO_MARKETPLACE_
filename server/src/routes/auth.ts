import { Router } from 'express';
import { register, login, me, logout } from '../controllers/authController';
import { protect } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { registerSchema, loginSchema } from '../utils/validation';

const router = Router();

router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.post('/logout', logout);
router.get('/me', protect, me);

export default router;
