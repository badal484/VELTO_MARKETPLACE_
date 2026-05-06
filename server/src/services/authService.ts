import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { OTP } from '../models/OTP';
import { AppError } from '../utils/errors';
import { sendEmail } from './emailService';
import { generateOTP, hashOTP } from '../utils/otp';

export class AuthService {
  static async requestRegister(data: any) {
    const existing = await User.findOne({ email: data.email });
    if (existing) throw new AppError('Email already in use', 409);

    // Create user directly
    const user = await User.create({
      ...data,
      isVerified: true, // Auto-verify for now
    });

    const token = jwt.sign(
      { id: String(user._id), role: user.role },
      process.env.JWT_SECRET || 'super_secret_velto_key_123',
      { expiresIn: '30d' } as any
    );
    
    return { 
      message: 'Registration successful (Verification Bypassed)',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token 
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
      process.env.JWT_SECRET || 'super_secret_velto_key_123',
      { expiresIn: '30d' } as any
    );

    const userObj = user.toObject() as any;
    delete userObj.password;
    return { token, user: userObj };
  }

  static async forgotPassword(email: string) {
    const user = await User.findOne({ email });
    if (!user) return { message: 'If email exists, OTP has been sent' };

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
      process.env.JWT_SECRET || 'super_secret_velto_key_123',
      { expiresIn: '30d' } as any
    );

    const userObj = user.toObject() as any;
    delete userObj.password;
    return { token, user: userObj };
  }
}
