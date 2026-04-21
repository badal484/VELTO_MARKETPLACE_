import { Request, Response } from 'express';
import { Wishlist } from '../models/Wishlist';
import { Product } from '../models/Product';

export const getWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    let wishlist = await Wishlist.findOne({ user: req.user._id }).populate('products');
    
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, products: [] });
    } else {
      // Filter out products that no longer exist (e.g. deleted by seller)
      wishlist.products = wishlist.products.filter(p => p !== null) as any;
    }

    res.status(200).json({ success: true, data: wishlist });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, message });
  }
};

export const toggleWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.body;
    
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      wishlist = new Wishlist({ user: req.user._id, products: [] });
    }

    const productIdStr = productId.toString();
    const productIndex = wishlist.products.findIndex(p => p.toString() === productIdStr);

    if (productIndex > -1) {
      // Remove if exists
      wishlist.products.splice(productIndex, 1);
    } else {
      // Add if not exists
      wishlist.products.push(productIdStr as any);
    }

    await wishlist.save();
    const populatedWishlist = await wishlist.populate('products');
    
    res.status(200).json({ success: true, data: populatedWishlist });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, message });
  }
};
