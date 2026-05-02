import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { AppError } from '../utils/errors';

export const validateRequest = (schema: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if schema is a "Request Schema" (with body/query/params) or just a body schema
      const shape = schema.shape || {};
      const isRequestSchema = shape.body || shape.query || shape.params;
      
      if (isRequestSchema) {
        const result = await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        });
        req.body = result.body || req.body;
        req.query = result.query || req.query;
        req.params = result.params || req.params;
      } else {
        // Assume it's a body schema
        req.body = await schema.parseAsync(req.body);
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = (error as any).issues || (error as any).errors || [];
        const message = issues.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ');
        return next(new AppError(message, 400));
      }
      next(error);
    }
  };
};
