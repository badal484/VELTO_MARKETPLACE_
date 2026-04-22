import { Request, Response } from 'express';
import { Review } from '../models/Review';
import { Order } from '../models/Order';
import { OrderStatus } from '@shared/types';
import { Types } from 'mongoose';
import { Product } from '../models/Product';

export const createReview = async (req: Request, res: Response) => {
  try {
    const { productId, orderId, rating, comment } = req.body;
    const userId = req.user?._id;

    if (!Types.ObjectId.isValid(productId) || !Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product or order ID.'
      });
    }

    // 1. Check if order exists and is completed by this user
    const order = await Order.findOne({
      _id: orderId,
      buyer: userId,
      product: productId,
      status: OrderStatus.COMPLETED
    });

    if (!order) {
      return res.status(400).json({
        success: false,
        message: 'You can only review products from completed orders.'
      });
    }

    // 2. Check if already reviewed
    const existingReview = await Review.findOne({ order: orderId });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this purchase.'
      });
    }

    // 3. Create review
    const review = await Review.create({
      user: userId,
      product: productId,
      order: orderId,
      rating,
      comment
    });

    // 4. Mark order as reviewed
    await Order.findByIdAndUpdate(orderId, { isReviewed: true });

    // 5. Trigger rating aggregation (background)
    updateProductRating(productId);

    res.status(201).json({
      success: true,
      data: review
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getProductReviews = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    if (!Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID.'
      });
    }

    const reviews = await Review.find({ product: productId })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    // Calculate average rating
    const stats = await Review.aggregate([
      { $match: { product: new Types.ObjectId(productId) } },
      {
        $group: {
          _id: '$product',
          averageRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        reviews,
        stats: stats[0] || { averageRating: 0, count: 0 }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const updateProductRating = async (productId: string) => {
  try {
    const stats = await Review.aggregate([
      { $match: { product: new Types.ObjectId(productId) } },
      {
        $group: {
          _id: '$product',
          averageRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      const { averageRating, count } = stats[0];
      await Product.findByIdAndUpdate(productId, {
        rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        numReviews: count
      });
      console.log(`--- UPDATED PRODUCT RATING: [${productId}] -> ${averageRating} stars (${count} reviews) ---`);
    }
  } catch (error) {
    console.error('Error aggregating product rating:', error);
  }
};