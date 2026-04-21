import { Request, Response, NextFunction } from 'express';
import { handleError } from '../utils/errors';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  handleError(err, res);
};

export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};
