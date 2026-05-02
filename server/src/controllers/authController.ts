import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { handleError } from '../utils/errors';
import { User } from '../models/User';
import { Shop } from '../models/Shop';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await AuthService.register(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    handleError(error, res);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await AuthService.login(req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(error, res);
  }
};

export const me = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id).select('-password').lean();
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const shop = await Shop.findOne({ owner: user._id });
    
    res.json({
      success: true,
      data: {
        ...user,
        hasShop: !!shop,
        isShopVerified: !!shop?.isVerified,
        shopRejectionReason: shop?.rejectionReason
      }
    });
  } catch (error) {
    handleError(error, res);
  }
};

export const logout = (req: Request, res: Response): void => {
  res.json({ success: true, message: 'Logged out successfully' });
};
