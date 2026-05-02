import { Request, Response } from 'express';
import { Cart } from '../models/Cart';
import { Product } from '../models/Product';
import { handleError, AppError } from '../utils/errors';

export const getCart = async (req: Request, res: Response): Promise<void> => {
  try {
    let cart = await Cart.findOne({ user: req.user?._id }).populate('items.product');
    
    if (!cart) {
      cart = await Cart.create({ user: req.user?._id, items: [] });
    } else {
      let changed = false;
      const now = new Date();
      
      const initialLength = cart.items.length;
      cart.items = cart.items.filter(item => item.product != null);
      if (cart.items.length !== initialLength) {
        changed = true;
      }

      for (const item of cart.items) {
        const product = item.product as any;
        if (item.lockedAt && (now.getTime() - new Date(item.lockedAt).getTime() > 30 * 60 * 1000)) {
           if (product && item.priceSnapshotted !== product.price) {
             item.priceSnapshotted = product.price;
             item.lockedAt = now;
             changed = true;
           }
        }
      }
      if (changed) await cart.save();
    }

    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    handleError(error, res);
  }
};

export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantity = 1 } = req.body;
    
    const product = await Product.findById(productId);
    if (!product) throw new AppError('Product not found', 404);

    let cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) {
      cart = new Cart({ user: req.user?._id, items: [] });
    }

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({ 
        product: productId, 
        quantity,
        priceSnapshotted: product.price,
        lockedAt: new Date()
      });
    }

    await cart.save();
    const populatedCart = await cart.populate('items.product');
    
    res.status(200).json({ success: true, data: populatedCart });
  } catch (error) {
    handleError(error, res);
  }
};

export const updateCartItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantity } = req.body;
    
    const cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) throw new AppError('Cart not found', 404);

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

    if (itemIndex > -1) {
      if (quantity <= 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        const product = await Product.findById(productId);
        cart.items[itemIndex].quantity = quantity;
        cart.items[itemIndex].lockedAt = new Date();
        if (product) cart.items[itemIndex].priceSnapshotted = product.price;
      }
      await cart.save();
      const populatedCart = await cart.populate('items.product');
      res.status(200).json({ success: true, data: populatedCart });
    } else {
      throw new AppError('Item not found in cart', 404);
    }
  } catch (error) {
    handleError(error, res);
  }
};

export const removeFromCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    
    const cart = await Cart.findOne({ user: req.user?._id });
    if (!cart) throw new AppError('Cart not found', 404);

    cart.items = cart.items.filter(item => item.product.toString() !== productId);
    await cart.save();
    const populatedCart = await cart.populate('items.product');
    
    res.status(200).json({ success: true, data: populatedCart });
  } catch (error) {
    handleError(error, res);
  }
};

export const clearCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const cart = await Cart.findOne({ user: req.user?._id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    
    res.status(200).json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    handleError(error, res);
  }
};

