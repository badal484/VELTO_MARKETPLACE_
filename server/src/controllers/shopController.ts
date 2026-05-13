import { Request, Response } from 'express';
import { ShopService } from '../services/shopService';
import { createShopSchema } from '../utils/validation';
import { handleError, AppError } from '../utils/errors';
import { Shop } from '../models/Shop';

export const createShop = async (req: Request, res: Response): Promise<void> => {
  try {
    const normalizedBody: any = { ...req.body };

    // Multipart form submissions send nested fields as strings.
    ['detailedAddress', 'location', 'bankDetails', 'contactInfo'].forEach(field => {
      if (typeof normalizedBody[field] === 'string') {
        try {
          normalizedBody[field] = JSON.parse(normalizedBody[field]);
        } catch {
          // Keep original value; schema validation below will surface the error clearly.
        }
      }
    });

    if (typeof normalizedBody.isTermsAccepted === 'string') {
      normalizedBody.isTermsAccepted = normalizedBody.isTermsAccepted === 'true';
    }

    const validatedData = createShopSchema.parse(normalizedBody);
    const shop = await ShopService.createShop(req.user?._id.toString()!, validatedData, req.files);
    res.status(201).json({ success: true, data: shop });
  } catch (error) {
    handleError(error, res);
  }
};

export const getShop = async (req: Request, res: Response): Promise<void> => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) throw new AppError('Shop not found', 404);

    const stats = await ShopService.getShopStats(shop._id.toString());
    
    res.json({ 
      success: true, 
      data: { ...shop.toObject(), stats }
    });
  } catch (error) {
    handleError(error, res);
  }
};

export const editShop = async (req: Request, res: Response): Promise<void> => {
  try {
    // Only partial validation for edit
    const shop = await ShopService.editShop(req.params.id, req.user?._id.toString()!, req.body, req.files);
    res.json({ success: true, data: shop });
  } catch (error) {
    handleError(error, res);
  }
};

export const getMyShop = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    const shop = await Shop.findOne({ owner: req.user._id });
    if (!shop) throw new AppError('Shop not found', 404);
    res.json({ success: true, data: shop });
  } catch (error) {
    handleError(error, res);
  }
};
