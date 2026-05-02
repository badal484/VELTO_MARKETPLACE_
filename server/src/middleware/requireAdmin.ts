import { Request, Response, NextFunction } from 'express';
import { Role } from '@shared/types';
import { AppError } from '../utils/errors';

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user && req.user.role === Role.ADMIN) {
    next();
  } else {
    next(new AppError('Access denied. Admins only.', 403));
  }
};