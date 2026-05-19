import { Request, Response } from 'express';
import { OrderService } from '../services/orderService';
import { WalletService } from '../services/WalletService';
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
    const { status, cancellationReason } = updateOrderStatusSchema.parse(req.body);
    const order = await OrderService.updateStatus(
      req.params.id,
      status,
      req.user?._id.toString()!,
      req.user?.role!,
      { reason: cancellationReason }
    );
    res.json({ success: true, data: order });
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

    if (order.rider?.toString() !== req.user?._id.toString()) {
      throw new AppError('Only the assigned rider can verify the delivery OTP', 403);
    }

    if (order.deliveryCode !== otp) {
      throw new AppError('Invalid delivery OTP', 400);
    }

    if (order.status !== OrderStatus.DELIVERED && 
        order.status !== OrderStatus.COMPLETED_PENDING_RELEASE && 
        order.status !== OrderStatus.COMPLETED) {
      await OrderService.updateStatus(
        id, 
        OrderStatus.DELIVERED, 
        req.user!._id.toString(), 
        req.user!.role
      );
    }

    const finalStatus = order.paymentMethod === 'Cash on Delivery' 
      ? OrderStatus.COMPLETED 
      : OrderStatus.COMPLETED_PENDING_RELEASE;

    let updated = order;
    if (order.status !== finalStatus) {
      updated = await OrderService.updateStatus(
        id, 
        finalStatus, 
        req.user!._id.toString(), 
        req.user!.role
      );
    }

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
      .populate('rider', 'name avatar phoneNumber')
      .lean();

    if (!order) throw new AppError('Order not found', 404);

    const userId = req.user?._id.toString();
    const userRole = req.user?.role;

    const buyerId = (order.buyer as any)?._id?.toString() || order.buyer?.toString();
    const sellerId = (order.seller as any)?._id?.toString() || order.seller?.toString();
    const riderId = (order.rider as any)?._id?.toString() || order.rider?.toString();

    const isParticipant =
      [buyerId, sellerId, riderId].some(id => id && id === userId) ||
      userRole === 'admin';

    if (!isParticipant) throw new AppError('Not authorized to view this order', 403);

    // Sellers must never see buyer contact details — enforced at API layer.
    // This prevents pharmacies and marketplace sellers from directly contacting buyers.
    const isSeller = userRole === 'seller' || userRole === 'shop_owner';
    const isSellersOrder = sellerId === userId;
    if (isSeller && isSellersOrder) {
      const sanitized = { ...order } as any;
      delete sanitized.buyerPhone;
      delete sanitized.deliveryAddress;
      if (sanitized.buyer) {
        const { phoneNumber: _p, ...buyerWithoutPhone } = sanitized.buyer as any;
        sanitized.buyer = buyerWithoutPhone;
      }
      res.json({ success: true, data: sanitized });
      return;
    }

    res.json({ success: true, data: order });
  } catch (error) {
    handleError(error, res);
  }
};

export const getMyOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Number(req.query.limit) || 20;
    const page = Number(req.query.page) || 1;

    const orders = await Order.find({ buyer: req.user?._id })
      .populate('product', 'title images price')
      .populate('shop', 'name logo address')
      .populate('seller', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({ success: true, data: orders });
  } catch (error) {
    handleError(error, res);
  }
};

export const getSellerOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Number(req.query.limit) || 20;
    const page = Number(req.query.page) || 1;

    const orders = await Order.find({
      seller: req.user?._id,
      status: { $ne: OrderStatus.PAYMENT_UNDER_REVIEW }
    })
      .populate('product', 'title images price')
      .populate('shop', 'name logo')
      .populate('buyer', 'name email phoneNumber')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Strip buyer contact details from pharmacy orders — pharmacies must never
    // directly contact patients outside the platform.
    const sanitized = orders.map((order: any) => {
      if (order.orderType !== 'pharmacy') return order;
      const { buyerPhone: _bp, deliveryAddress: _da, ...rest } = order;
      if (rest.buyer?.phoneNumber) {
        const { phoneNumber: _pn, ...buyerSafe } = rest.buyer;
        rest.buyer = buyerSafe;
      }
      return rest;
    });

    res.json({ success: true, data: sanitized });
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

    // Self-heal any active unassigned delivery orders with missing pickup locations
    const brokenOrders = await Order.find({
      status: { $in: [OrderStatus.CONFIRMED, OrderStatus.SEARCHING_RIDER, OrderStatus.READY_FOR_PICKUP] },
      fulfillmentMethod: 'delivery',
      $or: [{ pickupLocation: { $exists: false } }, { 'pickupLocation.coordinates': { $size: 0 } }, { pickupLocation: null }]
    }).populate('shop');

    for (const broken of brokenOrders) {
      if ((broken.shop as any)?.location?.coordinates?.length) {
        broken.pickupLocation = (broken.shop as any).location;
        await broken.save();
      }
    }

    const jobs = await OrderService.getAvailableJobs(
      req.user?._id.toString()!,
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
    const limit = Number(req.query.limit) || 50;
    const page = Number(req.query.page) || 1;

    const orders = await Order.find({ rider: req.user?._id })
      .populate('product', 'title images price')
      .populate('shop', 'name logo location address')
      .populate('buyer', 'name email avatar phoneNumber deliveryLocation')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const stats = await WalletService.getRiderStats(req.user?._id.toString()!);

    res.json({ success: true, data: orders, stats });
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
    const result = await OrderService.createBatchOrder(req.user?._id.toString()!, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    handleError(error, res);
  }
};
export const getBatchOrderQuote = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await OrderService.getDeliveryQuote(req.user?._id.toString()!, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(error, res);
  }
};
