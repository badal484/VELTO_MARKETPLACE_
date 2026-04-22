import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { AppError } from '../utils/errors';

export class AuthService {
  static async register(data: { name: string; email: string; password: string; role?: string; phoneNumber?: string }) {
    const existing = await User.findOne({ email: data.email });
    if (existing) throw new AppError('Email already in use', 409);

    const hashed = await bcrypt.hash(data.password, 10);
    const user = await User.create({ ...data, password: hashed });

    const token = jwt.sign(
      { _id: user._id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' } as any
    );

    const userObj = user.toObject() as any;
    delete userObj.password;
    return { token, user: userObj };
  }

  static async login(data: { email: string; password: string }) {
    const user = await User.findOne({ email: data.email });
    if (!user || !user.password) throw new AppError('Invalid credentials', 401);
    if (user.isBlocked) throw new AppError('Your account has been blocked', 403);

    const match = await bcrypt.compare(data.password, user.password);
    if (!match) throw new AppError('Invalid credentials', 401);

    const token = jwt.sign(
      { _id: user._id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' } as any
    );

    const userObj = user.toObject() as any;
    delete userObj.password;
    return { token, user: userObj };
  }
}
