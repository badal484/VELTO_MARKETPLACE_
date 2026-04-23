import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { Shop } from '../models/Shop';
import { Cart } from '../models/Cart';
import { Notification, NotificationType } from '../models/Notification';
import { io } from '../socket/socket';
import { OrderStatus, Role } from '@shared/types';
import { AppError } from '../utils/errors';
import { WalletService } from './WalletService';
import { WorkflowService } from './workflowService';
import { RazorpayService } from './RazorpayService';

export class OrderService {

  /**
   * Status Transition Matrix
   * Defines which status can move to which other status
   */
  private static readonly transitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.PAYMENT_UNDER_REVIEW, OrderStatus.CANCELLED],
    [OrderStatus.PAYMENT_UNDER_REVIEW]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.READY_FOR_PICKUP, OrderStatus.SEARCHING_RIDER, OrderStatus.CANCELLED],
    [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
    [OrderStatus.SEARCHING_RIDER]: [OrderStatus.RIDER_ASSIGNED, OrderStatus.CANCELLED],
    [OrderStatus.RIDER_ASSIGNED]: [OrderStatus.AT_SHOP, OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
    [OrderStatus.AT_SHOP]: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
    [OrderStatus.PICKED_UP]: [OrderStatus.IN_TRANSIT],
    [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED_PENDING_RELEASE, OrderStatus.COMPLETED],
    [OrderStatus.COMPLETED_PENDING_RELEASE]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
    [OrderStatus.COMPLETED]: [],
    [OrderStatus.CANCELLED]: [],
    [OrderStatus.PRICE_LOCKED]: []
  };



  static async createOrder(buyerId: string, data: any) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const product = await Product.findById(data.productId).session(session);
      if (!product) throw new AppError('Product not found', 404);
      if (product.stock < data.quantity) throw new AppError('Insufficient stock', 400);

      const totalPrice = (product.price * data.quantity) + (data.deliveryCharge || 0);
      // Codes are now generated dynamically during status transitions
      const { productId, ...rest } = data;
      const order = await Order.create([{
        ...rest,
        buyer: buyerId,
        product: productId,
        seller: product.seller,
        shop: product.shop,
        productSnapshot: {
          title: product.title,
          image: product.images[0] || '',
          originalPrice: product.price,
          category: product.category
        },
        totalPrice,
        status: OrderStatus.PENDING,
        pickupLocation: product.location,
        deliveryLocation: data.lat && data.lng ? {
          type: 'Point',
          coordinates: [data.lng, data.lat]
        } : undefined
      }], { session });

      // Atomic Stock Update
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: data.productId, stock: { $gte: data.quantity } },
        { $inc: { stock: -data.quantity } },
        { session, new: true }
      );

      if (!updatedProduct) throw new AppError('Race condition: Stock sold out', 400);

      // Clear Cart
      await Cart.findOneAndUpdate(
        { user: buyerId },
        { $pull: { items: { product: data.productId } } },
        { session }
      );

      await session.commitTransaction();

      // Side Effects (Post-Commit)
      const orderId = order[0]?._id?.toString();
      const sellerId = order[0]?.seller?.toString();

      if (orderId) {
        await WorkflowService.syncOrderState(orderId, OrderStatus.PENDING, 'System: New order placed successfully.');
      }
      
      if (sellerId) {
        io.to(sellerId).emit('new_order', order[0]);
      }

      return order[0];
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async updateStatus(orderId: string, newStatus: OrderStatus, actorId: string, actorRole: string) {
    const order = await Order.findById(orderId).populate('buyer seller');
    if (!order) throw new AppError('Order not found', 404);

    const currentStatus = order.status as OrderStatus;
    const allowed = this.transitions[currentStatus] || [];
    
    if (!allowed.includes(newStatus)) {
      throw new AppError(`Invalid transition from ${currentStatus} to ${newStatus}`, 400);
    }

    // Role-based Transition Permissions
    // Role-based Transition Permissions
    const getIdentifier = (val: any) => val?._id ? val._id.toString() : val?.toString();

    const isSeller = getIdentifier(order.seller) === actorId;
    const isBuyer = getIdentifier(order.buyer) === actorId;
    const isRider = getIdentifier(order.rider) === actorId;
    const isAdmin = actorRole === 'admin';

    if (newStatus === OrderStatus.CANCELLED) {
      if (!isBuyer && !isSeller && !isAdmin) throw new AppError('Unauthorized cancellation', 403);
      if (isBuyer && ![OrderStatus.PENDING, OrderStatus.SEARCHING_RIDER, OrderStatus.PAYMENT_UNDER_REVIEW].includes(currentStatus)) {
        throw new AppError('Cannot cancel order in current state', 400);
      }
      // Revert stock
      await Product.findByIdAndUpdate(order.product, { $inc: { stock: order.quantity } });
    }

    if (newStatus === OrderStatus.READY_FOR_PICKUP && !isSeller && !isAdmin) {
      throw new AppError('Only seller can mark order as ready', 403);
    }

    if (newStatus === OrderStatus.PICKED_UP && !isRider && !isAdmin && !isSeller) {
      throw new AppError('Only the assigned rider or seller can mark as picked up', 403);
    }

    if (newStatus === OrderStatus.DELIVERED && !isRider && !isAdmin) {
      throw new AppError('Only the assigned rider can mark as delivered', 403);
    }

    if (!isSeller && !isAdmin && !isBuyer && !isRider) throw new AppError('Not authorized', 403);

    // Dynamic PIN Generation
    if (newStatus === OrderStatus.READY_FOR_PICKUP && order.fulfillmentMethod === 'pickup' && !order.pickupCode) {
      order.pickupCode = Math.floor(1000 + Math.random() * 9000).toString();
    }
    
    if (newStatus === OrderStatus.IN_TRANSIT && order.fulfillmentMethod === 'delivery' && !order.deliveryCode) {
      order.deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();
    }

    order.status = newStatus;
    await order.save();

    // 💸 FINANCIAL FULFILLMENT 💸
    if (newStatus === OrderStatus.COMPLETED) {
      // 1. Credit Seller
      await WalletService.creditSellerEarnings(orderId).catch(err => console.error('Seller credit failed:', err));
      
      // 2. Credit Rider Delivery Earnings
      await WalletService.creditEarnings(orderId).catch(err => console.error('Rider credit failed:', err));

      // 3. Handle COD Liability if applicable
      if (order.paymentMethod === 'Cash on Delivery') {
        await WalletService.processCODFulfillment(orderId).catch(err => console.error('COD processing failed:', err));
      }
    }

    // Trigger Financial Refund if order was cancelled after payment
    if (newStatus === OrderStatus.CANCELLED) {
      await WalletService.refundToWallet(orderId);
    }

    await WorkflowService.syncOrderState(order._id.toString(), newStatus);
    
    // 🚚 Auto-Assignment disabled per user request for manual testing/demo purposes
    /*
    if (newStatus === OrderStatus.SEARCHING_RIDER) {
      console.log(`[AUTO-ASSIGN] Order ${orderId} is looking for a rider. Attempting auto-match...`);
      OrderService.autoAssignRider(orderId).catch(err => {
        console.error('[AUTO-ASSIGN] Error during matching:', err);
      });
    }
    */

    return order;
  }

  static async getAvailableJobs(riderId: string, riderLocation: [number, number], radiusMetres: number = 5000) {
    const rider = await User.findById(riderId);
    if (!rider || !rider.isOnline) {
      console.log(`[GEO] Rider ${riderId} is offline. No jobs returned.`);
      return [];
    }

    console.log(`[GEO] Searching jobs for rider at: lng=${riderLocation[0]}, lat=${riderLocation[1]} (radius: ${radiusMetres}m)`);
    
    const results = await Order.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: riderLocation },
          distanceField: 'distanceMetres',
          maxDistance: radiusMetres,
          spherical: true,
          key: 'pickupLocation', // Explicitly use the pickupLocation index
          query: { 
            status: { $in: [OrderStatus.SEARCHING_RIDER, OrderStatus.READY_FOR_PICKUP] },
            fulfillmentMethod: 'delivery',
            rider: { $exists: false },
            seller: { $ne: new mongoose.Types.ObjectId(riderId) }
          }
        }
      },
      // Redundant safety filter for strict enforcement
      {
        $match: {
          distanceMetres: { $lte: radiusMetres }
        }
      },
      {
        $addFields: {
          priorityScore: {
            $add: [
              { $multiply: [{ $divide: [1, { $max: [1, "$distanceMetres"] }] }, 400] },
              { $multiply: ["$totalPrice", 0.003] }
            ]
          }
        }
      },
      { $sort: { priorityScore: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: 'shops',
          localField: 'shop',
          foreignField: '_id',
          as: 'shop'
        }
      },
      { $unwind: '$shop' },
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'users',
          localField: 'buyer',
          foreignField: '_id',
          as: 'buyer'
        }
      },
      { $unwind: '$buyer' }
    ]);

    console.log(`[GEO] Found ${results.length} local jobs.`);
    return results;
  }

  static async claimOrder(orderId: string, riderId: string) {
    // Security check: Ensure rider is verified
    const rider = await User.findById(riderId);
    if (!rider || !rider.isRiderVerified) {
      throw new AppError('You must be a verified rider to claim orders', 403);
    }
    
    if (!rider.isOnline) {
      throw new AppError('You are currently offline. Please go online to claim jobs.', 403);
    }

    const orderToClaim = await Order.findById(orderId);
    if (orderToClaim && orderToClaim.seller.toString() === riderId) {
      throw new AppError('Security Alert: You cannot claim your own shop orders for delivery.', 403);
    }

    // Liability limit check removed as per user request to allow larger single-order cash handling.

    const activeJobsCount = await Order.countDocuments({
      rider: riderId,
      status: { $nin: [
        OrderStatus.COMPLETED, 
        OrderStatus.CANCELLED, 
        OrderStatus.DELIVERED, 
        OrderStatus.COMPLETED_PENDING_RELEASE
      ] }
    });
    
    if (activeJobsCount >= 5) {
      throw new AppError('[V2] Job Limit Reached: You can only handle 5 active deliveries at a time.', 400);
    }

    // Atomic update to prevent race conditions
    const order = await Order.findOneAndUpdate(
      { 
        _id: orderId, 
        rider: { $exists: false }, 
        status: { $in: [OrderStatus.SEARCHING_RIDER, OrderStatus.READY_FOR_PICKUP] } 
      },
      { 
        $set: { 
          rider: riderId, 
          status: OrderStatus.RIDER_ASSIGNED 
        } 
      },
      { new: true }
    );

    if (!order) {
      throw new AppError('Order already claimed or not available', 400);
    }

    await WorkflowService.syncOrderState(order._id.toString(), OrderStatus.RIDER_ASSIGNED, 'System: Delivery partner assigned. Heading to pickup.');
    return order;
  }

  /**
   * 🤖 AUTO-ASSIGNMENT ENGINE
   * Finds the nearest available, verified rider for an order.
   */
  static async autoAssignRider(orderId: string) {
    const order = await Order.findById(orderId);
    if (!order || order.status !== OrderStatus.SEARCHING_RIDER || order.rider) return;

    const pickupLocation = order.pickupLocation!.coordinates; // [lng, lat]
    
    // 1. Find "Maxed Out" riders (those with 5+ active assignments)
    const activeJobsAgg = await Order.aggregate([
      { 
        $match: { 
          status: { 
            $nin: [
              OrderStatus.COMPLETED, 
              OrderStatus.CANCELLED, 
              OrderStatus.DELIVERED, 
              OrderStatus.COMPLETED_PENDING_RELEASE
            ] 
          }, 
          rider: { $exists: true } 
        } 
      },
      { $group: { _id: "$rider", count: { $sum: 1 } } },
      { $match: { count: { $gte: 5 } } }
    ]);
    const maxedRiders = activeJobsAgg.map(r => r._id);

    // 2. Adaptive Expansion Logic: (1km -> 2.5km -> 5km)
    const radii = [1000, 2500, 5000];
    let assignedRider = null;

    for (const radius of radii) {
      console.log(`[AUTO-ASSIGN] Attempting local match at ${radius/1000}km radius for order ${orderId}...`);
      
      const potentialRiders = await User.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: pickupLocation },
            distanceField: 'distanceMetres',
            maxDistance: radius,
            spherical: true,
            query: {
              role: Role.RIDER,
              isRiderVerified: true,
              isBlocked: { $ne: true },
              _id: { $nin: [...maxedRiders, order.seller] }
            }
          }
        },
        { $limit: 1 }
      ]);

      if (potentialRiders.length > 0) {
        assignedRider = potentialRiders[0];
        console.log(`[AUTO-ASSIGN] Success! Found rider at ${radius/1000}km: ${assignedRider.name}`);
        break; 
      }
    }

    if (assignedRider) {
      // 3. Atomically assign the rider
      const updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId, status: OrderStatus.SEARCHING_RIDER, rider: { $exists: false } },
        { $set: { rider: assignedRider._id, status: OrderStatus.RIDER_ASSIGNED } },
        { new: true }
      );

      if (updatedOrder) {
        await WorkflowService.syncOrderState(
          orderId, 
          OrderStatus.RIDER_ASSIGNED, 
          `🚀 Velto Express: Delivery partner assigned (${(assignedRider.distanceMetres/1000).toFixed(2)}km away).`
        );

        // 4. Notify the Rider via Socket
        io.to(assignedRider._id.toString()).emit('order_assigned', {
          orderId,
          message: 'New order auto-assigned to you!',
          order: updatedOrder
        });
      }
    } else {
      console.log(`[AUTO-ASSIGN] Critical: No riders found even at 5km for order ${orderId}. Remains in pool.`);
    }
  }

  static async selfReleaseOrder(orderId: string, riderId: string) {
    const order = await Order.findOne({ 
      _id: orderId, 
      rider: riderId,
      status: OrderStatus.RIDER_ASSIGNED // Only allowed BEFORE pickup
    });

    if (!order) {
      throw new AppError('Order cannot be released at this stage. Contact support.', 400);
    }

    order.rider = undefined;
    order.status = OrderStatus.SEARCHING_RIDER;
    await order.save();

    await WorkflowService.syncOrderState(
      order._id.toString(), 
      OrderStatus.SEARCHING_RIDER, 
      '⚠️ Rider Update: Delivery partner had an emergency and unassigned. Searching for a new partner...'
    );

    return order;
  }

  static async createBatchOrder(buyerId: string, data: any) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { items, fulfillmentMethod, deliveryAddress, deliveryCharge, buyerPhone, paymentMethod } = data;
      
      // -- Aggregation Logic --
      // Group items by productId to avoid duplicate order entries for the same product
      const aggregatedItems = items.reduce((acc: any[], item: any) => {
        const existing = acc.find(i => i.productId === item.productId);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          acc.push({ ...item });
        }
        return acc;
      }, []);

      const createdOrders = [];

      for (const item of aggregatedItems) {
        // 1. Find product and verify stock inside session
        const product = await Product.findById(item.productId).session(session);
        if (!product) throw new AppError(`Product not found: ${item.productId}`, 404);
        if (product.stock < item.quantity) {
          throw new AppError(`Insufficient stock for ${product.title}. Available: ${product.stock}`, 400);
        }

        // 2. Prepare Order data
        const itemPrice = item.price || product.price;
        const currentDeliveryCharge = fulfillmentMethod === 'pickup' ? 0 : (deliveryCharge || 0);
        const isRazorpay = paymentMethod === 'Razorpay';
        const initialStatus = isRazorpay ? OrderStatus.PAYMENT_UNDER_REVIEW : OrderStatus.PENDING;

        // Codes are now generated dynamically during status transitions
        let itemTotalPrice = (itemPrice * item.quantity) + (currentDeliveryCharge / items.length);

        // 3. Create Order document
        const [order] = await Order.create([{
          buyer: buyerId,
          seller: product.seller,
          shop: product.shop,
          product: product._id,
          productSnapshot: {
            title: product.title,
            image: product.images[0] || '',
            originalPrice: product.price,
            category: product.category
          },
          quantity: item.quantity,
          totalPrice: itemTotalPrice,
          status: initialStatus,
          paymentMethod,
          paymentReference: data.paymentReference,
          fulfillmentMethod,
          deliveryAddress,
          deliveryCharge: currentDeliveryCharge / items.length,
          buyerPhone,
          pickupLocation: product.location,
          deliveryLocation: data.lat && data.lng ? {
            type: 'Point',
            coordinates: [data.lng, data.lat]
          } : undefined
        }], { session });

        // 4. Atomic Stock Update
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: product._id, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { session, new: true }
        );

        if (!updatedProduct) throw new AppError(`Race condition: Stock sold out for ${product.title}`, 400);

        createdOrders.push(order);
      }

      // 5. If it's a Razorpay payment, create the official order
      let razorpayOrder: any = null;
      if (paymentMethod === 'Razorpay') {
        if (createdOrders.length === 0) {
          throw new AppError('No orders were created. Please check your cart items.', 400);
        }
        const totalAmount = createdOrders.reduce((acc, order) => acc + order.totalPrice, 0);
        razorpayOrder = await RazorpayService.createOrder(totalAmount, createdOrders[0]._id.toString());
        
        // Update all specific orders with the Razorpay Order ID
        await Order.updateMany(
          { _id: { $in: createdOrders.map(o => o._id) } },
          { $set: { razorpayOrderId: razorpayOrder.id } },
          { session }
        );

        // Update local objects for immediate response
        createdOrders.forEach(o => o.razorpayOrderId = razorpayOrder.id);
      }

      // 6. Clear Cart (Atomic)
      await Cart.findOneAndUpdate(
        { user: buyerId },
        { $set: { items: [] } },
        { session }
      );

      await session.commitTransaction();

      // -- SIDE EFFECTS (Post-Commit) --
      // 7. Workflow Sync for each item
      for (const order of createdOrders) {
        const orderId = order?._id?.toString();
        const sellerId = order?.seller?.toString();

        if (orderId) {
          await WorkflowService.syncOrderState(
            orderId, 
            order.status as any, 
            undefined, 
            { silent: true } 
          );
        }
        
        if (sellerId) {
          io.to(sellerId).emit('new_order', order);
        }
      }

      // 8. Consolidated Notification for Buyer
      if (createdOrders.length > 0) {
        const firstOrder = createdOrders[0];
        const firstOrderId = firstOrder?._id?.toString();

        if (firstOrderId) {
          const summaryMsg = createdOrders.length === 1 
            ? `🎉 Success! Your order for ${firstOrder.productSnapshot?.title || 'item'} has been placed.`
            : `🎉 Success! Your batch order for ${createdOrders.length} items has been placed successfully.`;
          
          await WorkflowService.syncOrderState(
            firstOrderId,
            firstOrder.status as any,
            summaryMsg,
            { silent: false }
          );
        }
      }

      return {
        orders: createdOrders,
        razorpayOrder
      };
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }
  }
}
