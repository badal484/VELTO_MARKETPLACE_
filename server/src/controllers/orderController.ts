import { Request, Response } from 'express';
import { OrderService } from '../services/orderService';
import { createOrderSchema, updateOrderStatusSchema } from '../utils/validation';
import { handleError, AppError } from '../utils/errors';
import { Order } from '../models/Order';
import { OrderStatus } from '@shared/types';

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = createOrderSchema.parse(req.body);
    const order = await OrderService.createOrder(req.user?._id.toString()!, validatedData);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    handleError(error, res);
  }
};

export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = updateOrderStatusSchema.parse(req.body);
    const order = await OrderService.updateStatus(
      req.params.id, 
      status, 
      req.user?._id.toString()!, 
      req.user?.role!
    );
    res.json({ success: true, data: order });
  } catch (error) {
    handleError(error, res);
  }
};

export const verifyOrderOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { otp } = req.body;

    const order = await Order.findById(id);
    if (!order) throw new AppError('Order not found', 404);

    // Pickup OTP is verified by the seller
    if (order.seller.toString() !== req.user?._id.toString()) {
      throw new AppError('Only the seller can verify the pickup OTP', 403);
    }

    if (order.pickupCode !== otp) {
      throw new AppError('Invalid pickup OTP', 400);
    }

    const updated = await OrderService.updateStatus(
      id, 
      'completed' as any, 
      req.user._id.toString(), 
      req.user.role
    );

    res.json({ success: true, message: 'Pickup verified. Order completed!', data: updated });
  } catch (error) {
    handleError(error, res);
  }
};

export const verifyDeliveryOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { otp } = req.body;

    const order = await Order.findById(id);
    if (!order) throw new AppError('Order not found', 404);

    // Delivery OTP is verified by the rider
    if (order.rider?.toString() !== req.user?._id.toString()) {
      throw new AppError('Only the assigned rider can verify the delivery OTP', 403);
    }

    if (order.deliveryCode !== otp) {
      throw new AppError('Invalid delivery OTP', 400);
    }

    // Move to DELIVERED first
    await OrderService.updateStatus(
      id, 
      'delivered' as any, 
      req.user!._id.toString(), 
      req.user!.role
    );

    // Then move to COMPLETED
    const updated = await OrderService.updateStatus(
      id, 
      'completed' as any, 
      req.user!._id.toString(), 
      req.user!.role
    );

    res.json({ success: true, message: 'Delivery verified. Order completed!', data: updated });
  } catch (error) {
    handleError(error, res);
  }
};

export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('product')
      .populate('shop')
      .populate('buyer', 'name avatar phoneNumber')
      .populate('seller', 'name avatar')
      .populate('rider', 'name avatar phoneNumber');

    if (!order) throw new AppError('Order not found', 404);

    const userId = req.user?._id.toString();
    const isParticipant =
      order.buyer?.toString() === userId ||
      order.seller?.toString() === userId ||
      order.rider?.toString() === userId ||
      req.user?.role === 'admin';

    if (!isParticipant) throw new AppError('Not authorized to view this order', 403);

    res.json({ success: true, data: order });
  } catch (error) {
    handleError(error, res);
  }
};

export const getMyOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await Order.find({ buyer: req.user?._id })
      .populate('product')
      .populate('shop')
      .populate('seller', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (error) {
    handleError(error, res);
  }
};

export const getSellerOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await Order.find({ 
      seller: req.user?._id,
      status: { $ne: OrderStatus.PAYMENT_UNDER_REVIEW } 
    })
      .populate('product')
      .populate('shop')
      .populate('buyer', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (error) {
    handleError(error, res);
  }
};

export const getAvailableJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { lat, lng, radius } = req.query;
    
    if (!lat || !lng) {
      throw new AppError('Rider location (lat, lng) is required for discovering jobs', 400);
    }

    const jobs = await OrderService.getAvailableJobs(
      [Number(lng), Number(lat)],
      radius ? Number(radius) : 5000
    );
    res.json({ success: true, data: jobs });
  } catch (error) {
    handleError(error, res);
  }
};

export const claimOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await OrderService.claimOrder(req.params.id, req.user?._id.toString()!);
    res.json({ success: true, data: order, message: 'Order claimed successfully!' });
  } catch (error) {
    handleError(error, res);
  }
};

export const getRiderOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await Order.find({ rider: req.user?._id })
      .populate('product')
      .populate('shop')
      .populate('buyer', 'name email avatar phoneNumber')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (error) {
    handleError(error, res);
  }
};

export const releaseOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await OrderService.selfReleaseOrder(req.params.id, req.user?._id.toString()!);
    res.json({ success: true, message: 'You have been unassigned from the order.', data: order });
  } catch (error) {
    handleError(error, res);
  }
};

export const createBatchOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await OrderService.createBatchOrder(req.user?._id.toString()!, req.body);
    res.status(201).json({ success: true, data: orders });
  } catch (error) {
    handleError(error, res);
  }
};