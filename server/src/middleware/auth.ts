import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { AppError } from '../utils/errors';
import { Role } from '@shared/types';

export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let token: string | undefined;

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    return next(new AppError('Not authorized, no token provided', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_velto_key_123') as jwt.JwtPayload;
    const userId = decoded.id || decoded._id;
    
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return next(new AppError('User no longer exists', 401));
    }

    if (user.isBlocked) {
      return next(new AppError('Account is suspended. Please contact support.', 403));
    }

    req.user = user;
    next();
  } catch (error) {
    next(new AppError('Not authorized, token failed', 401));
  }
};
export const optional = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_velto_key_123') as jwt.JwtPayload;

      const userId = decoded.id || decoded._id;
      const user = await User.findById(userId).select('-password');
      if (user) {
        req.user = user;
      }
    } catch (error) {
      // Don't error out, just continue as guest
    }
  }
  next();
};