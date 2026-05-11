import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { OTP } from '../models/OTP';
import { AppError } from '../utils/errors';
import { sendEmail } from './emailService';
import { generateOTP, hashOTP } from '../utils/otp';
import { OAuth2Client } from 'google-auth-library';

const JWT_SECRET = (() => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET environment variable is required');
  return s;
})();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export class AuthService {
  static async requestRegister(data: any) {
    const existing = await User.findOne({ email: data.email });
    if (existing) throw new AppError('Email already in use', 409);

    // Bypassing OTP for Launch: Create user immediately
    const hashed = await bcrypt.hash(data.password, 10);
    const user = await User.create({ ...data, password: hashed });

    const token = jwt.sign(
      { id: String(user._id), role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' } as any
    );

    const userObj = user.toObject() as any;
    delete userObj.password;

    return { 
      message: 'Registration successful!',
      token,
      user: userObj
    };
  }

  static async verifyRegister(email: string, otp: string) {
    const otpRecord = await OTP.findOne({
      email,
      type: 'email_verify',
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord || otpRecord.otp !== hashOTP(otp)) {
      throw new AppError('Invalid or expired OTP', 400);
    }

    const data = (otpRecord as any).metadata;
    if (!data) throw new AppError('Registration data lost. Please register again.', 400);

    const hashed = await bcrypt.hash(data.password, 10);
    const user = await User.create({ ...data, password: hashed });

    await OTP.updateOne({ _id: otpRecord._id }, { isUsed: true });

    const token = jwt.sign(
      { id: String(user._id), role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' } as any
    );

    const userObj = user.toObject() as any;
    delete userObj.password;
    return { token, user: userObj };
  }

  static async forgotPassword(email: string) {
    const user = await User.findOne({ email });
    if (!user) throw new AppError('No account found with this email address', 404);

    const otp = generateOTP();
    await OTP.deleteMany({ email, type: 'forgot_password' });

    await OTP.create({
      email,
      otp: hashOTP(otp),
      type: 'forgot_password',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // Send email in background to prevent timeout on slow SMTP connections
    sendEmail(email, 'forgot_password', { name: user.name, otp }).catch(err => {
      console.error(`[EMAIL ERROR] Failed to send forgot-password OTP to ${email}:`, err);
    });
    return { message: 'Password reset OTP sent to email' };
  }

  static async resetPassword(data: any) {
    const { email, otp, newPassword } = data;
    const otpRecord = await OTP.findOne({
      email,
      type: 'forgot_password',
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord || otpRecord.otp !== hashOTP(otp)) {
      throw new AppError('Invalid or expired OTP', 400);
    }

    const user = await User.findOne({ email });
    if (!user) throw new AppError('User not found', 404);

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await OTP.updateOne({ _id: otpRecord._id }, { isUsed: true });
    return { message: 'Password reset successfully' };
  }

  static async login(data: { email: string; password: string }) {
    const { email, password } = data;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.password) throw new AppError('Invalid credentials', 401);
    if (user.isBlocked) throw new AppError('Your account has been blocked', 403);

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new AppError('Invalid credentials', 401);

    const token = jwt.sign(
      { id: String(user._id), role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' } as any
    );

    const userObj = user.toObject() as any;
    delete userObj.password;
    return { token, user: userObj };
  }

  static async requestLoginOTP(email: string) {
    const user = await User.findOne({ email });
    if (!user) throw new AppError('No account found with this email', 404);
    if (user.isBlocked) throw new AppError('Your account has been blocked', 403);

    const otp = generateOTP();
    await OTP.deleteMany({ email, type: 'login' });

    await OTP.create({
      email,
      otp: hashOTP(otp),
      type: 'login',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 mins
    });

    sendEmail(email, 'login_otp', { name: user.name, otp }).catch(err => {
      console.error(`[EMAIL ERROR] Failed to send login OTP to ${email}:`, err);
    });

    return { message: 'Login OTP sent to email' };
  }

  static async verifyLoginOTP(email: string, otp: string) {
    const otpRecord = await OTP.findOne({
      email,
      type: 'login',
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord || otpRecord.otp !== hashOTP(otp)) {
      throw new AppError('Invalid or expired OTP', 400);
    }

    const user = await User.findOne({ email });
    if (!user) throw new AppError('User not found', 404);

    await OTP.updateOne({ _id: otpRecord._id }, { isUsed: true });

    const token = jwt.sign(
      { id: String(user._id), role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' } as any
    );

    const userObj = user.toObject() as any;
    delete userObj.password;
    return { token, user: userObj };
  }

  static async googleLogin(idToken: string) {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) throw new AppError('Invalid Google Token', 400);

      const { email, name, picture, sub: googleId } = payload;

      let user = await User.findOne({ email });

      if (!user) {
        // Create new user if they don't exist
        user = await User.create({
          email,
          name: name || email.split('@')[0],
          isVerified: true,
          googleId,
          role: 'buyer', // Default role
        });
      } else if (user.isBlocked) {
        throw new AppError('Your account has been blocked', 403);
      }

      const token = jwt.sign(
        { id: String(user._id), role: user.role },
        JWT_SECRET,
        { expiresIn: '30d' } as any
      );

      const userObj = user.toObject() as any;
      delete userObj.password;
      return { token, user: userObj };
    } catch (error: any) {
      console.error('[GOOGLE_AUTH_ERROR]', error);
      throw new AppError(error.message || 'Google Authentication failed', 401);
    }
  }
}
