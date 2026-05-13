import { Router } from 'express';
import { register, login, me, logout, forgotPassword, resetPassword, verifyOTP, requestLoginOTP, verifyLoginOTP, googleLogin } from '../controllers/authController';
import { protect } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { registerSchema, loginSchema } from '../utils/validation';

const router = Router();

router.post('/register', validateRequest(registerSchema), register);
router.post('/verify-otp', verifyOTP);
router.post('/login', validateRequest(loginSchema), login);
router.post('/login-otp-request', requestLoginOTP);
router.post('/login-otp-verify', verifyLoginOTP);
router.post('/google-login', googleLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', logout);
router.get('/me', protect, me);

export default router;
