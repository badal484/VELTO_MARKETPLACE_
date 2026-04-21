import { Request, Response, NextFunction } from 'express';
import { Banner } from '../models/Banner';
import { uploadImage } from '../utils/imagekit';
import { AppError } from '../utils/errors';

export const getBanners = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: banners });
  } catch (error) {
    next(error);
  }
};

export const getAdminBanners = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: banners });
  } catch (error) {
    next(error);
  }
};

export const createBanner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, subtitle, category } = req.body;
    let imageUrl = '';

    if (req.file) {
      imageUrl = await uploadImage(req.file.buffer, `banner_${Date.now()}`);
    } else {
      throw new AppError('Banner image is required', 400);
    }

    const banner = await Banner.create({
      title,
      subtitle,
      category,
      imageUrl,
      isActive: true
    });

    res.status(201).json({ success: true, data: banner });
  } catch (error) {
    next(error);
  }
};

export const toggleBannerStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) throw new AppError('Banner not found', 404);

    banner.isActive = !banner.isActive;
    await banner.save();

    res.status(200).json({ success: true, data: banner });
  } catch (error) {
    next(error);
  }
};

export const deleteBanner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) throw new AppError('Banner not found', 404);
    res.status(200).json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
    next(error);
  }
};