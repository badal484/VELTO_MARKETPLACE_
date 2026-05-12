import { Request, Response } from 'express';
import { ShopService } from '../services/shopService';
import { createShopSchema } from '../utils/validation';
import { handleError, AppError } from '../utils/errors';
import { Shop } from '../models/Shop';

const parseNestedFields = (inputBody: any) => {
  const body = { ...inputBody };
  const jsonFields = ['detailedAddress', 'location', 'bankDetails', 'contactInfo'];
  
  jsonFields.forEach(field => {
    if (typeof body[field] === 'string') {
      try {
        let cleaned = body[field].trim();
        // Unwrap double-encoded JSON strings or extraneous surrounding quotes
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
          cleaned = cleaned.slice(1, -1).replace(/\\"/g, '"');
        }
        // Parse if it looks like JSON object
        if (cleaned.startsWith('{')) {
          body[field] = JSON.parse(cleaned);
        }
      } catch (e) {
        console.warn(`[ShopController] Failed to parse ${field}:`, e);
      }
    }

    // Ensure nested lat/lng in location are strict Numbers for Zod float rules
    if (field === 'location' && body[field] && typeof body[field] === 'object') {
      body[field].lat = Number(body[field].lat) || 0;
      body[field].lng = Number(body[field].lng) || 0;
    }
  });

  if (body.isTermsAccepted === 'true') body.isTermsAccepted = true;
  if (body.isTermsAccepted === 'false') body.isTermsAccepted = false;

  return body;
};

export const createShop = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedBody = parseNestedFields(req.body);
    const validatedData = createShopSchema.parse(parsedBody);
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
    const parsedBody = parseNestedFields(req.body);
    const shop = await ShopService.editShop(req.params.id, req.user?._id.toString()!, parsedBody, req.files);
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
