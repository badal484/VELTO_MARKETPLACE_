import { Request, Response, NextFunction } from 'express';
import { Role } from '@shared/types';

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user && req.user.role === Role.ADMIN) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
  }
};