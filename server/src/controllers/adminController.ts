import { Request, Response } from 'express';
import { Shop } from '../models/Shop';
import { User } from '../models/User';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { Conversation } from '../models/Conversation';
import { io } from '../socket/socket';
import { NotificationType } from '../models/Notification';
import { OrderStatus, IUser } from '@shared/types';
import { SocketEvent } from '@shared/constants/socketEvents';
import { WorkflowService } from '../services/workflowService';
import { OrderService } from '../services/orderService';
import { NotificationService } from '../services/notificationService';
import { handleError, AppError } from '../utils/errors';

export const getPendingShops = async (req: Request, res: Response): Promise<void> => {
  try {
    // Robust check for shops that are NOT verified AND don't have a valid rejection reason
    const shops = await Shop.find({ 
      isVerified: false, 
      $or: [
        { rejectionReason: { $exists: false } },
        { rejectionReason: null },
        { rejectionReason: "" }
      ]
    }).populate('owner', 'name email');
    res.json({ success: true, data: shops });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getAllShops = async (req: Request, res: Response): Promise<void> => {
  try {
    const shops = await Shop.aggregate([
      // Lookup listings count
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'shop',
          as: 'listings'
        }
      },
      // Lookup total revenue from orders
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'shop',
          as: 'orders'
        }
      },
      // Lookup owner details
      {
        $lookup: {
          from: 'users',
          localField: 'owner',
          foreignField: '_id',
          as: 'owner'
        }
      },
      { $unwind: '$owner' },
      {
        $project: {
          name: 1,
          category: 1,
          isVerified: 1,
          rejectionReason: 1,
          address: 1,
          createdAt: 1,
          owner: { _id: 1, name: 1, email: 1 },
          listingCount: { $size: '$listings' },
          totalRevenue: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$orders',
                    as: 'order',
                    cond: { $ne: ['$$order.status', 'cancelled'] }
                  }
                },
                as: 'o',
                in: '$$o.totalPrice'
              }
            }
          }
        }
      }
    ]);

    res.json({ success: true, data: shops });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const approveShop = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`--- APPROVING SHOP: ${req.params.id} ---`);
    const shop = await Shop.findByIdAndUpdate(
      req.params.id,
      { isVerified: true, verifiedAt: new Date(), rejectionReason: undefined },
      { new: true }
    );
    
    if (shop) {
      // Step 1: Update the user's role to shop owner
      await User.findByIdAndUpdate(shop.owner, { role: 'shop_owner' });

      // Step 2: Push real-time event to the owner's active session
      io.to(shop.owner.toString()).emit('shop_status_update', { 
        success: true, 
        isVerified: true, 
        message: 'Your shop has been approved!' 
      });
      io.to(shop.owner.toString()).emit(SocketEvent.USER_STATE_UPDATED, { role: 'shop_owner', isVerified: true });

      // Step 3: Save formal notification and dispatch push alert
      try {
        await NotificationService.send({
          recipient: shop.owner.toString(),
          type: NotificationType.SHOP,
          title: 'Shop Verified',
          message: 'Success: Your shop has been officially verified. You are now authorized to list products and accept orders from the community. Welcome to Velto.',
          data: { shopId: shop._id }
        });
      } catch (notifyErr) {
        console.error('Notification Error:', notifyErr);
      }
    }

    res.json({ success: true, data: shop });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const rejectShop = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reason } = req.body;
    console.log(`--- REJECTING SHOP: ${req.params.id} ---`);
    console.log('REASON:', reason);
    
    const shop = await Shop.findByIdAndUpdate(
      req.params.id,
      { isVerified: false, rejectionReason: reason },
      { new: true }
    );
    if (shop) {
      // Step 1: Push real-time rejection event
      io.to(shop.owner.toString()).emit('shop_status_update', { 
        success: true, 
        isVerified: false, 
        rejectionReason: reason,
        message: 'Your shop application was rejected.' 
      });
      io.to(shop.owner.toString()).emit(SocketEvent.USER_STATE_UPDATED, { isVerified: false, rejectionReason: reason });

      // Step 2: Save formal notification and dispatch push alert
      try {
        await NotificationService.send({
          recipient: shop.owner.toString(),
          type: NotificationType.SHOP,
          title: 'Verification Update',
          message: `Application Update: Your shop verification could not be completed at this time. Reason: ${reason}. Please update your profile with valid details to re-apply.`,
          data: { shopId: shop._id, rejectionReason: reason }
        });
      } catch (notifyErr) {
        console.error('Notification Error:', notifyErr);
      }
    }

    res.json({ success: true, data: shop });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.aggregate([
      { $match: {} },
      // Lookup orders as buyer
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'buyer',
          as: 'buyerOrders'
        }
      },
      // Lookup shop if they own one
      {
        $lookup: {
          from: 'shops',
          localField: '_id',
          foreignField: 'owner',
          as: 'shop'
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          role: 1,
          createdAt: 1,
           totalSpent: { $sum: '$buyerOrders.totalPrice' },
           orderCount: { $size: '$buyerOrders' },
           shop: { $arrayElemAt: ['$shop', 0] },
           // Rider Fields
            isRiderVerified: 1,
            riderStatus: 1,
            riderRejectionReason: 1,
            riderDocuments: 1,
            licenseNumber: 1,
            vehicleDetails: 1
         }
       },
      { $sort: { createdAt: -1 } }
    ]);
    
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // 1. Prevent self-deletion or platform-admin deletion
    if (req.user?._id.toString() === id) {
      throw new Error('Self-deletion is not permitted. Contact a platform administrator.');
    }

    const userToDelete = await User.findById(id);
    if (userToDelete?.email === 'admin@velto.com') {
      throw new Error('The primary platform administrator account cannot be deleted.');
    }

    // 2. Check for active orders as buyer or seller
    const activeOrder = await Order.findOne({
      $or: [{ buyer: id }, { seller: id }],
      status: { $nin: ['completed', 'cancelled'] }
    });

    if (activeOrder) {
      throw new Error('Cannot delete user with active orders. Complete or cancel orders first.');
    }

    // 2. Check if user owns a shop with products
    const shop = await Shop.findOne({ owner: id });
    if (shop) {
      const productCount = await Product.countDocuments({ shop: shop._id });
      if (productCount > 0) {
        throw new Error('Cannot delete user who owns a shop with listed products. Delete products first.');
      }
      await shop.deleteOne();
    }

    await User.findByIdAndDelete(id);
    res.json({ success: true, message: 'User and associated shop (if empty) deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const toggleUserBlock = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw new Error('User not found');
    
    user.isBlocked = !user.isBlocked;
    await user.save();
    
    res.json({ 
      success: true, 
      message: `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`,
      data: { isBlocked: user.isBlocked }
    });

    // Real-time Push
    io.to(user._id.toString()).emit(SocketEvent.USER_STATE_UPDATED, { isBlocked: user.isBlocked });
    if (user.isBlocked) {
      io.to(user._id.toString()).emit('force_logout', { message: 'Your account has been restricted by an administrator.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const verifyRider = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        isRiderVerified: true, 
        riderStatus: 'verified',
        role: 'rider', // Assign the Rider role upon verification
        riderRejectionReason: undefined 
      },
      { new: true }
    );
    
    if (user) {
      // Push real-time event
      io.to(user._id.toString()).emit('rider_status_update', { 
        success: true, 
        isRiderVerified: true, 
        riderStatus: 'verified',
        message: 'Your rider account has been verified!' 
      });
      io.to(user._id.toString()).emit(SocketEvent.USER_STATE_UPDATED, { role: 'rider', isRiderVerified: true });

      // Formal notification and push alert
      await NotificationService.send({
        recipient: user._id.toString(),
        type: NotificationType.INFO,
        title: 'Platform Access: Rider Verified',
        message: 'Success: Your documentation has been verified. You can now accept deliveries on the Velto platform.',
        data: { userId: user._id }
      });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const rejectRider = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reason } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        isRiderVerified: false, 
        riderStatus: 'rejected',
        riderRejectionReason: reason 
      },
      { new: true }
    );
    
    if (user) {
      // Push real-time rejection event
      io.to(user._id.toString()).emit('rider_status_update', { 
        success: true, 
        isRiderVerified: false, 
        riderStatus: 'rejected',
        rejectionReason: reason,
        message: 'Your rider application was rejected.' 
      });
      io.to(user._id.toString()).emit(SocketEvent.USER_STATE_UPDATED, { isRiderVerified: false, riderStatus: 'rejected', rejectionReason: reason });

      // Formal notification and push alert
      await NotificationService.send({
        recipient: user._id.toString(),
        type: NotificationType.INFO,
        title: 'Verification Update',
        message: `Application Update: Your rider verification could not be completed at this time. Reason: ${reason}. Please update your profile with valid documents to re-apply.`,
        data: { userId: user._id, rejectionReason: reason }
      });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await Product.find({}).populate('seller', 'name email').populate('shop', 'name');
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if product is part of any active order
    const activeOrder = await Order.findOne({
      product: id,
      status: { $nin: ['completed', 'cancelled'] }
    });

    if (activeOrder) {
      throw new Error('Cannot delete product with active orders. Complete or cancel orders first.');
    }

    await Product.findByIdAndDelete(id);
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

// Stats computation...

export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalUsers = await User.countDocuments();
    const totalShops = await Shop.countDocuments();
    const pendingShops = await Shop.countDocuments({ isVerified: false });
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalConversations = await Conversation.countDocuments({});

    // Aggregation for Total Revenue
    const revenueData = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);

    const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

    // Aggregation for Daily Sales (Last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailySales = await Order.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo }, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          amount: { $sum: "$totalPrice" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // Aggregation for Monthly Sales (Last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlySales = await Order.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          amount: { $sum: "$totalPrice" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // High-Precision Platform Commission Calculation (5% Item Cut + 10% Delivery Cut)
    const commissionStats = await Order.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          sellerComm: { $sum: { $multiply: [{ $multiply: ["$productSnapshot.originalPrice", "$quantity"] }, 0.05] } }, // 5% of item price
          riderComm: { $sum: { $multiply: ["$deliveryCharge", 0.10] } } // 10% of delivery fee
        }
      }
    ]);

    const platformRevenue = commissionStats.length > 0 
      ? (commissionStats[0].sellerComm + commissionStats[0].riderComm) 
      : 0;

    // Aggregation for Top 5 Shops by Revenue
    const topShops = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: "$shop",
          revenue: { $sum: "$totalPrice" },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'shops',
          localField: '_id',
          foreignField: '_id',
          as: 'shopDetails'
        }
      },
      { $unwind: '$shopDetails' },
      {
        $project: {
          name: '$shopDetails.name',
          category: '$shopDetails.category',
          revenue: 1,
          orderCount: 1
        }
      }
    ]);

    // Order Distribution
    const orderDistribution = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // Rider Funnel
    const totalRiders = await User.countDocuments({ role: 'rider' });
    const pendingRiders = await User.countDocuments({ riderStatus: 'pending' });

    res.json({
      success: true,
      data: { 
        totalUsers, 
        totalShops, 
        pendingShops, 
        totalProducts, 
        totalOrders,
        totalConversations,
        totalRevenue,
        platformRevenue,
        dailySales,
        monthlySales,
        topShops,
        orderDistribution,
        riderStats: {
          total: totalRiders,
          pending: pendingRiders
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getAllOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await Order.find({})
      .populate('buyer', 'name email avatar')
      .populate('shop', 'name logo')
      .populate('product', 'title images')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const forceReleaseOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    
    if (!order) throw new Error('Order not found');
    
    // Only allow releasing if the order is currently assigned to a rider and not completed
    if (!order.rider) throw new Error('Order is not currently assigned to any rider');
    if (['completed', 'cancelled'].includes(order.status as string)) {
      throw new Error('Cannot release a finalized order');
    }

    const previousRiderId = order.rider;
    order.rider = undefined;
    order.status = OrderStatus.SEARCHING_RIDER;
    await order.save();

    // Notify the previous rider that they've been unassigned
    io.to(previousRiderId.toString()).emit('order_unassigned', {
      orderId: order._id,
      message: 'You have been unassigned from this order by an administrator.'
    });

    // Notify buyer and seller
    await WorkflowService.syncOrderState(
      order._id.toString(), 
      OrderStatus.SEARCHING_RIDER, 
      '⚠️ Admin Override: Previous rider unassigned. Re-searching for a new delivery partner...'
    );

    res.json({ success: true, message: 'Order released and reset to searching rider' });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
};

export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id).populate('buyer seller');
    if (!order) throw new Error('Order not found');

    const updated = await OrderService.updateStatus(
      id, 
      OrderStatus.CONFIRMED, 
      req.user!._id.toString(), 
      req.user!.role
    );
     res.json({ success: true, message: 'Payment verified and order confirmed.', data: updated });
  } catch (error) {
    handleError(error, res);
  }
};