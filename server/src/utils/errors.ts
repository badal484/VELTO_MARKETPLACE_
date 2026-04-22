import { Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const handleError = (err: any, res: Response) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: err.issues[0]?.message || 'Validation Error',
      errors: err.issues.map((e) => ({
        path: e.path.join('.'),
        message: e.message
      }))
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }

  console.error('--- UNEXPECTED ERROR ---', err);
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
  });
};