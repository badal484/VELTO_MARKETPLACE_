import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';

export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_velto_key_123') as jwt.JwtPayload;

      const userId = decoded.id || decoded._id;
      const user = await User.findById(userId).select('-password');
      if (user) {
        if (user.isBlocked) {
          res.status(403).json({ success: false, message: 'Account is suspended. Please contact support.' });
          return;
        }
        req.user = user;
        return next();
      } else {
        res.status(401).json({ success: false, message: 'User no longer exists.' });
        return;
      }
    } catch (error) {
      res.status(401).json({ success: false, message: 'Not authorized, token failed' });
      return;
    }
  }

  // Also check query token (useful for direct file downloads)
  if (!token && req.query.token) {
    token = req.query.token as string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_velto_key_123') as jwt.JwtPayload;
      const userId = decoded.id || decoded._id;
      const user = await User.findById(userId).select('-password');
      if (user) {
        req.user = user;
        return next();
      }
    } catch (error) {
      res.status(401).json({ success: false, message: 'Not authorized, token failed' });
      return;
    }
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Not authorized, no token' });
    return;
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