import { Request, Response } from 'express';
import { ProductService } from '../services/productService';
import { createProductSchema } from '../utils/validation';
import { handleError, AppError } from '../utils/errors';
import { Product } from '../models/Product';
import { Wishlist } from '../models/Wishlist';

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = createProductSchema.parse({
      ...req.body,
      price: Number(req.body.price),
      stock: Number(req.body.stock)
    });
    
    const product = await ProductService.createProduct(
      req.user?._id.toString()!,
      validatedData,
      req.files as any[]
    );
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    handleError(error, res);
  }
};

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await ProductService.getDiscoveryProducts(req.user?._id.toString(), req.query);
    res.json({ success: true, data: products });
  } catch (error) {
    handleError(error, res);
  }
};

export const getSingleProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('shop')
      .populate('seller', '-password');
      
    if (!product) throw new AppError('Product not found', 404);

    const productObj = product.toObject() as any;
    productObj.isWishlisted = false;
    
    if (req.user) {
      const wishlist = await Wishlist.findOne({ user: req.user._id });
      if (wishlist) {
        productObj.isWishlisted = wishlist.products.some(id => id.toString() === product._id.toString());
      }
    }

    res.json({ success: true, data: productObj });
  } catch (error) {
    handleError(error, res);
  }
};

export const editProduct = async (req: Request, res: Response): Promise<void> => {
  // Simple edit for now, can add strict validation later
  try {
    const product = await Product.findById(req.params.id);
    if (!product) throw new AppError('Product not found', 404);
    if (product.seller.toString() !== req.user?._id.toString()) throw new AppError('Not authorized', 403);

    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: updated });
  } catch (error) {
    handleError(error, res);
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) throw new AppError('Product not found', 404);
    if (product.seller.toString() !== req.user?._id.toString() && req.user?.role !== 'admin') {
      throw new AppError('Not authorized', 403);
    }
    await product.deleteOne();
    res.json({ success: true, message: 'Product removed' });
  } catch (error) {
    handleError(error, res);
  }
};

export const getMyProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await Product.find({ seller: req.user?._id }).populate('shop').lean();
    res.json({ success: true, data: products });
  } catch (error) {
    handleError(error, res);
  }
};
