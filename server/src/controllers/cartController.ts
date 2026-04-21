import { Request, Response } from 'express';
import { Cart } from '../models/Cart';
import { Product } from '../models/Product';

export const getCart = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    let cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    } else {
      // Reconcile prices if expired and clean up deleted products
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, message });
  }
};

export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantity = 1 } = req.body;
    
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, message });
  }
};

export const updateCartItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantity } = req.body;
    
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      res.status(404).json({ success: false, message: 'Cart not found' });
      return;
    }

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

    if (itemIndex > -1) {
      if (quantity <= 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        const product = await Product.findById(productId);
        cart.items[itemIndex].quantity = quantity;
        // Optional: Refresh timer on explicit quantity update
        cart.items[itemIndex].lockedAt = new Date();
        if (product) cart.items[itemIndex].priceSnapshotted = product.price;
      }
      await cart.save();
      const populatedCart = await cart.populate('items.product');
      res.status(200).json({ success: true, data: populatedCart });
    } else {
      res.status(404).json({ success: false, message: 'Item not found in cart' });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, message });
  }
};

export const removeFromCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      res.status(404).json({ success: false, message: 'Cart not found' });
      return;
    }

    cart.items = cart.items.filter(item => item.product.toString() !== productId);
    await cart.save();
    const populatedCart = await cart.populate('items.product');
    
    res.status(200).json({ success: true, data: populatedCart });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, message });
  }
};

export const clearCart = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    
    res.status(200).json({ success: true, message: 'Cart cleared' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, message });
  }
};
