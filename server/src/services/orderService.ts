import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { Shop } from '../models/Shop';
import { Cart } from '../models/Cart';
import { Notification, NotificationType } from '../models/Notification';
import { io } from '../socket/socket';
import { OrderStatus, Role, TransactionCategory } from '@shared/types';
import { SocketEvent } from '@shared/constants/socketEvents';
import { AppError } from '../utils/errors';
import { WalletService } from './WalletService';
import { WorkflowService } from './workflowService';
import { RazorpayService } from './RazorpayService';
import { ZoneService } from './ZoneService';
import { calculateDistance, calculateDeliveryFee } from '../utils/geo';
import { round } from '../utils/math';

export class OrderService {

  /**
   * Status Transition Matrix
   * Defines which status can move to which other status
   */
  private static readonly transitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.AWAITING_SELLER_CONFIRMATION, OrderStatus.PAYMENT_UNDER_REVIEW, OrderStatus.CANCELLED, OrderStatus.CONFIRMED],
    [OrderStatus.PAYMENT_UNDER_REVIEW]: [OrderStatus.AWAITING_SELLER_CONFIRMATION, OrderStatus.CANCELLED],
    [OrderStatus.AWAITING_SELLER_CONFIRMATION]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.READY_FOR_PICKUP, OrderStatus.SEARCHING_RIDER, OrderStatus.CANCELLED],
    [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.SEARCHING_RIDER, OrderStatus.CANCELLED],
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
      //  SERVICE ZONE VALIDATION 
      const fulfillmentMethod = 'delivery';
      if (data.lat && data.lng) {
        const zone = await ZoneService.checkServiceability(data.lng, data.lat);
        if (!zone) {
          throw new AppError('Sorry! We do not serve this location yet. Velto is currently expanding across specific regions in India.', 400);
        }
      }

      const product = await Product.findById(data.productId).populate('shop').session(session);
      if (!product) throw new AppError('Product not found', 404);
      if (product.stock < data.quantity) throw new AppError('Insufficient stock', 400);

      //  DYNAMIC DELIVERY CHARGE 
      let deliveryCharge = 40; // Default fallback
      const pickupCoords = product.location?.coordinates?.length ? product.location.coordinates : (product.shop as any)?.location?.coordinates;
      if (data.lat && data.lng && pickupCoords) {
        const [shopLng, shopLat] = pickupCoords;
        const distance = calculateDistance(shopLat, shopLng, data.lat, data.lng);
        deliveryCharge = calculateDeliveryFee(distance, product.size as any);
      }

      const subtotal = round(product.price * data.quantity);
      const finalDeliveryCharge = deliveryCharge;

      const totalPrice = subtotal; // Keep as product-only for commission logic
      const { productId, ...rest } = data;
      const order = await Order.create([{
        ...rest,
        buyer: buyerId,
        product: productId,
        seller: product.seller,
        shop: product.shop?._id || product.shop,
        productSnapshot: {
          title: product.title,
          image: product.images[0] || '',
          originalPrice: product.price,
          category: product.category
        },
        fulfillmentMethod,
        totalPrice,
        deliveryCharge: finalDeliveryCharge,
        status: OrderStatus.PENDING,
        pickupLocation: product.location?.coordinates?.length ? product.location : (product.shop as any)?.location,
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
        io.to(sellerId).emit(SocketEvent.NEW_ORDER_FOR_SELLER, order[0]);
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

  static async updateStatus(orderId: string, newStatus: OrderStatus, actorId: string, actorRole: string, options: { refundDestination?: string, reason?: string } = {}) {
    const order = await Order.findById(orderId).populate('buyer seller');
    if (!order) throw new AppError('Order not found', 404);

    if (options.refundDestination) {
      (order as any).refundDestination = options.refundDestination;
      (order as any).refundStatus = options.refundDestination === 'wallet' ? 'completed' : 'pending';
    }

    if (options.reason) {
      order.cancellationReason = options.reason;
    }

    const currentStatus = order.status as OrderStatus;
    const allowed = this.transitions[currentStatus] || [];
    
    if (!allowed.includes(newStatus)) {
      throw new AppError(`Invalid transition from ${currentStatus} to ${newStatus}`, 400);
    }

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
      if (isSeller && !options.reason?.trim()) {
        throw new AppError('A cancellation reason is required when declining an order', 400);
      }
      // Revert stock
      await Product.findByIdAndUpdate(order.product, { $inc: { stock: order.quantity } });
    }

    if (newStatus === OrderStatus.READY_FOR_PICKUP && !isSeller && !isAdmin) {
      throw new AppError('Only seller can mark order as ready', 403);
    }

    if (newStatus === OrderStatus.CONFIRMED && !isSeller && !isAdmin) {
      throw new AppError('Only the seller can confirm this order', 403);
    }

    if (newStatus === OrderStatus.PICKED_UP && !isRider && !isAdmin && !isSeller) {
      throw new AppError('Only the assigned rider or seller can mark as picked up', 403);
    }

    if (newStatus === OrderStatus.DELIVERED && !isRider && !isAdmin) {
      throw new AppError('Only the assigned rider can mark as delivered', 403);
    }

    if (!isSeller && !isAdmin && !isBuyer && !isRider) throw new AppError('Not authorized', 403);

    // Dynamic PIN Generation
    // Pickup OTP disabled as per requirement
    /*
    if (newStatus === OrderStatus.READY_FOR_PICKUP && !order.pickupCode) {
      order.pickupCode = Math.floor(1000 + Math.random() * 9000).toString();
    }
    */
    
    if (newStatus === OrderStatus.IN_TRANSIT && order.fulfillmentMethod === 'delivery' && !order.deliveryCode) {
      order.deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();
    }

    if (newStatus === OrderStatus.DELIVERED) {
      order.deliveredAt = new Date();
    }

    order.status = newStatus;
    await order.save();

    //  AUTO-TRIGGER RIDER SEARCH
    if (newStatus === OrderStatus.READY_FOR_PICKUP && order.fulfillmentMethod === 'delivery') {
      // Trigger rider search only after seller marks order as ready — not on confirm
      setTimeout(() => {
        this.autoAssignRider(order._id.toString()).catch(console.error);
      }, 1000);
    }

    //  FINANCIAL FULFILLMENT 
    if (newStatus === OrderStatus.COMPLETED || newStatus === OrderStatus.COMPLETED_PENDING_RELEASE) {
      if (order.rider) {
        await WalletService.creditEarnings(orderId).catch(err => console.error('Rider credit failed:', err));
      }

      if (order.paymentMethod === 'Cash on Delivery') {
        await WalletService.processCODFulfillment(orderId).catch(err => console.error('COD processing failed:', err));
      }
    }

    if (newStatus === OrderStatus.COMPLETED) {
      await WalletService.creditSellerEarnings(orderId).catch(err => console.error('Seller credit failed:', err));
    }

    if (newStatus === OrderStatus.CANCELLED) {
      await WalletService.refundToWallet(orderId);
      // Compensate rider if assigned
      if (order.rider) {
        await WalletService.compensateRiderForCancellation(orderId).catch(err => console.error('Rider compensation failed:', err));
      }
    }

    const statusMessage = newStatus === OrderStatus.CANCELLED && options.reason
      ? `Your order has been cancelled. Reason: ${options.reason}`
      : undefined;
    await WorkflowService.syncOrderState(order._id.toString(), newStatus, statusMessage);

    return order;
  }

  static async getAvailableJobs(riderId: string, riderLocation: [number, number], radiusMetres: number = 5000) {
    const rider = await User.findById(riderId).select('isOnline').lean();
    if (!rider || !rider.isOnline) {
      console.log(`[GEO] Rider ${riderId} is offline. No jobs returned.`);
      return [];
    }

    const zone = await ZoneService.checkServiceability(riderLocation[0], riderLocation[1]);
    
    const targetStatuses = [
      OrderStatus.SEARCHING_RIDER,
      OrderStatus.READY_FOR_PICKUP
    ];

    if (!zone) {
      console.log(`[GEO] Rider ${riderId} is outside active Service Zones (Option 2 blocking applied).`);
      
      // Preserve emulator fallback query strictly for non-production environments
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[GEO] [DEV ONLY] Executing Absolute Fallback query for out-of-zone emulator testing account...`);
        const fallbackJobs = await Order.find({
          status: { $in: targetStatuses },
          fulfillmentMethod: 'delivery',
          rider: null
        })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('shop')
        .populate('product')
        .populate('buyer')
        .lean();

        return fallbackJobs;
      }

      return [];
    }
    
    const searchCenter: [number, number] = [zone.center.coordinates[0], zone.center.coordinates[1]];
    const searchRadius = zone.radius * 1000; // Convert km to meters
    console.log(`[GEO] Rider mapped to Service Zone: "${zone.name}". Querying full zone radius (${zone.radius}km) from zone center.`);
    

    const results = await Order.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: searchCenter },
          distanceField: 'distanceMetres',
          maxDistance: searchRadius,
          spherical: true,
          key: 'pickupLocation',
          query: {
            status: { $in: [OrderStatus.SEARCHING_RIDER, OrderStatus.READY_FOR_PICKUP] },
            fulfillmentMethod: 'delivery',
            $or: [{ rider: { $exists: false } }, { rider: null }]
          }
        }
      },
      {
        $match: {
          distanceMetres: { $lte: searchRadius }
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

    if (results.length === 0) {
      console.log(`[GEO] No local jobs found. Executing Absolute Fallback query for emulator testing...`);
      const fallbackJobs = await Order.find({
        status: { $in: targetStatuses },
        fulfillmentMethod: 'delivery',
        rider: null
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('shop')
      .populate('product')
      .populate('buyer')
      .lean();

      console.log(`[GEO] Fallback returned ${fallbackJobs.length} jobs.`);
      return fallbackJobs;
    }

    console.log(`[GEO] Found ${results.length} local jobs.`);
    return results;
  }

  static async claimOrder(orderId: string, riderId: string) {
    const rider = await User.findById(riderId).select('isRiderVerified isOnline').lean();
    if (!rider || !rider.isRiderVerified) {
      throw new AppError('You must be a verified rider to claim orders', 403);
    }
    
    if (!rider.isOnline) {
      throw new AppError('You are currently offline. Please go online to claim jobs.', 403);
    }

    // Removed same-seller check to allow unified dev accounts to test end-to-end flow

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

    const order = await Order.findOneAndUpdate(
      { 
        _id: orderId, 
        $or: [{ rider: { $exists: false } }, { rider: null }], 
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
    io.emit('order_status_updated', order);
    return order;
  }

  static async autoAssignRider(orderId: string) {
    const order = await Order.findById(orderId).select('status rider pickupLocation seller').lean();
    if (!order || ![OrderStatus.SEARCHING_RIDER, OrderStatus.READY_FOR_PICKUP].includes(order.status as OrderStatus) || order.rider) return;

    const pickupLocation = order.pickupLocation!.coordinates;
    
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

    const radii = [1000, 2500, 5000];
    let assignedRider = null;

    for (const radius of radii) {
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
              _id: { $nin: maxedRiders }
            }
          }
        },
        { $limit: 1 }
      ]);

      if (potentialRiders.length > 0) {
        assignedRider = potentialRiders[0];
        break; 
      }
    }

    if (assignedRider) {
      const updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId, status: { $in: [OrderStatus.SEARCHING_RIDER, OrderStatus.READY_FOR_PICKUP] }, $or: [{ rider: { $exists: false } }, { rider: null }] },
        { $set: { rider: assignedRider._id, status: OrderStatus.RIDER_ASSIGNED } },
        { new: true }
      );

      if (updatedOrder) {
        await WorkflowService.syncOrderState(
          orderId, 
          OrderStatus.RIDER_ASSIGNED, 
          ` Velto Express: Delivery partner assigned (${(assignedRider.distanceMetres/1000).toFixed(2)}km away).`
        );

        io.to(assignedRider._id.toString()).emit('order_assigned', {
          orderId,
          message: 'New order auto-assigned to you!',
          order: updatedOrder
        });
        io.emit('order_status_updated', updatedOrder);
      }
    } else if (order.status === OrderStatus.READY_FOR_PICKUP) {
      const updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId, status: OrderStatus.READY_FOR_PICKUP },
        { $set: { status: OrderStatus.SEARCHING_RIDER } },
        { new: true }
      );
      if (updatedOrder) {
        io.emit('order_status_updated', updatedOrder);
      }
    }
  }

  static async selfReleaseOrder(orderId: string, riderId: string) {
    const order = await Order.findOneAndUpdate(
      { 
        _id: orderId, 
        rider: riderId,
        status: OrderStatus.RIDER_ASSIGNED
      },
      {
        $unset: { rider: "" },
        $set: { status: OrderStatus.SEARCHING_RIDER }
      },
      { new: true }
    );

    if (!order) {
      throw new AppError('Order cannot be released at this stage. Contact support.', 400);
    }

    await WorkflowService.syncOrderState(
      order._id.toString(), 
      OrderStatus.SEARCHING_RIDER, 
      '️ Rider Update: Delivery partner had an emergency and unassigned. Searching for a new partner...'
    );

    return order;
  }

  static async createBatchOrder(buyerId: string, data: any) {
    const session = await mongoose.startSession();
    session.startTransaction();
 
    try {
      //  SERVICE ZONE VALIDATION 
      const fulfillmentMethod = 'delivery';
      if (data.lat && data.lng) {
        const zone = await ZoneService.checkServiceability(data.lng, data.lat);
        if (!zone) {
          throw new AppError('Sorry! We do not serve this location yet. Velto is currently expanding across specific regions in India.', 400);
        }
      }

      const { items, deliveryAddress, deliveryCharge, buyerPhone, paymentMethod, useWallet } = data;
      
      const user = await User.findById(buyerId).session(session);
      if (!user) throw new AppError('User not found', 404);

      const aggregatedItems = items.reduce((acc: any[], item: any) => {
        const existing = acc.find(i => i.productId === item.productId);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          acc.push({ ...item });
        }
        return acc;
      }, []);

      let totalBatchAmount = 0;
      const tempItems = [];
      for (const item of aggregatedItems) {
        const product = await Product.findById(item.productId).session(session);
        if (!product) throw new AppError(`Product not found: ${item.productId}`, 404);
        
        //  DYNAMIC DELIVERY CHARGE PER ITEM 
        let itemDeliveryCharge = 40; 
        if (data.lat && data.lng && product.location?.coordinates) {
          const [shopLng, shopLat] = product.location.coordinates;
          const distance = calculateDistance(shopLat, shopLng, data.lat, data.lng);
          itemDeliveryCharge = calculateDeliveryFee(distance, product.size as any);
        }

        const itemPrice = item.price || product.price;
        const itemTotalPrice = round(itemPrice * item.quantity);

        totalBatchAmount += itemTotalPrice;
        tempItems.push({ ...item, product, itemDeliveryCharge, itemTotalPrice });
      }

      const finalBatchDeliveryFee = tempItems.reduce((sum, item) => sum + (item.itemDeliveryCharge || 0), 0);
      
      // The total the user MUST pay
      const totalPayable = totalBatchAmount + finalBatchDeliveryFee;

      let walletDeduction = 0;
      if (useWallet && user.walletBalance && user.walletBalance > 0) {
        walletDeduction = Math.min(totalPayable, user.walletBalance);
        
        // Deduct from user
        user.walletBalance = round(user.walletBalance - walletDeduction);
        await user.save({ session });

        // Create Debit Transaction
        const { WalletTransaction } = require('../models/WalletTransaction');
        await WalletTransaction.create([{
          user: buyerId,
          amount: walletDeduction,
          type: 'debit',
          category: TransactionCategory.ORDER_PAYMENT,
          description: `Wallet used for batch order`,
        }], { session });
      }

      const createdOrders = [];
      let remainingWalletToDistribute = walletDeduction;

      for (let i = 0; i < tempItems.length; i++) {
        const item = tempItems[i];
        const product = item.product;
        
        if (product.stock < item.quantity) {
          throw new AppError(`Insufficient stock for ${product.title}. Available: ${product.stock}`, 400);
        }

        const itemTotalPrice = item.itemTotalPrice;
        const itemDeliveryCharge = item.itemDeliveryCharge;
        const itemTotalWithDelivery = itemTotalPrice + itemDeliveryCharge;
        
        // Distribute wallet deduction proportionally based on item total (with delivery)
        let itemWalletPaid = 0;
        if (i === tempItems.length - 1) {
          itemWalletPaid = remainingWalletToDistribute;
        } else {
          itemWalletPaid = round((itemTotalWithDelivery / totalPayable) * walletDeduction);
          remainingWalletToDistribute -= itemWalletPaid;
        }

        const isRazorpay = paymentMethod === 'Razorpay';
        const isDirectUPI = paymentMethod === 'Direct UPI Transfer';
        // If wallet covers full amount, status should be CONFIRMED immediately
        const isFullyPaidByWallet = itemWalletPaid >= itemTotalWithDelivery;
        const initialStatus = isRazorpay 
          ? (isFullyPaidByWallet ? OrderStatus.AWAITING_SELLER_CONFIRMATION : OrderStatus.PAYMENT_UNDER_REVIEW) 
          : (isDirectUPI ? OrderStatus.PAYMENT_UNDER_REVIEW : OrderStatus.AWAITING_SELLER_CONFIRMATION);

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
          walletAmountPaid: itemWalletPaid,
          status: initialStatus,
          paymentMethod,
          paymentReference: data.paymentReference,
          fulfillmentMethod,
          deliveryAddress,
          deliveryCharge: itemDeliveryCharge,
          buyerPhone,
          pickupLocation: product.location,
          deliveryLocation: data.lat && data.lng ? {
            type: 'Point',
            coordinates: [data.lng, data.lat]
          } : undefined
        }], { session });

        const updatedProduct = await Product.findOneAndUpdate(
          { _id: product._id, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { session, new: true }
        );

        if (!updatedProduct) throw new AppError(`Race condition: Stock sold out for ${product.title}`, 400);

        createdOrders.push(order);
      }

      let razorpayOrder: any = null;
      if (paymentMethod === 'Razorpay') {
        const remainingToPay = round(totalPayable - walletDeduction);
        
        if (remainingToPay > 0) {
          razorpayOrder = await RazorpayService.createOrder(remainingToPay, createdOrders[0]._id.toString());
          
          await Order.updateMany(
            { _id: { $in: createdOrders.map(o => o._id) } },
            { $set: { razorpayOrderId: razorpayOrder.id } },
            { session }
          );
  
          createdOrders.forEach(o => o.razorpayOrderId = razorpayOrder.id);
        } else {
           // Fully paid by wallet
           // Status is already CONFIRMED for Razorpay path if fully paid
        }
      }

      await Cart.findOneAndUpdate(
        { user: buyerId },
        { $set: { items: [] } },
        { session }
      );

      await session.commitTransaction();

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
          const isPrepaidPending = paymentMethod === 'Razorpay' && order.status === OrderStatus.PAYMENT_UNDER_REVIEW;
          if (!isPrepaidPending) {
            io.to(sellerId).emit(SocketEvent.NEW_ORDER_FOR_SELLER, order);
          }
        }
      }

      if (createdOrders.length > 0) {
        const firstOrder = createdOrders[0];
        const firstOrderId = firstOrder?._id?.toString();

        if (firstOrderId) {
          const status = firstOrder.status as OrderStatus;
          
          // Defensive check: Never send a success notification if payment is still under review (Razorpay/UPI)
          if (status !== OrderStatus.PAYMENT_UNDER_REVIEW) {
            console.log(`[OrderService] Sending order placement notification for order ${firstOrderId}. Status: ${status}`);
            
            const summaryMsg = createdOrders.length === 1
              ? `Order placed! Your order for ${firstOrder.productSnapshot?.title || 'item'} is awaiting seller confirmation.`
              : `Order placed! Your ${createdOrders.length}-item order is awaiting seller confirmation.`;

            await WorkflowService.syncOrderState(
              firstOrderId,
              status,
              summaryMsg,
            );
          } else {
            console.log(`[OrderService] Notification suppressed for order ${firstOrderId} as payment is still under review.`);
          }
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

  static async getDeliveryQuote(buyerId: string, data: any) {
    const { items, lat, lng } = data;
    if (!items || !lat || !lng) throw new AppError('Items and coordinates required', 400);

    let totalDeliveryFee = 0;
    const itemQuotes = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) continue;

      let itemFee = 40;
      let distance = 0;
      if (product.location?.coordinates) {
        const [shopLng, shopLat] = product.location.coordinates;
        distance = calculateDistance(shopLat, shopLng, lat, lng);
        itemFee = calculateDeliveryFee(distance, product.size as any);
      }

      totalDeliveryFee += itemFee;
      itemQuotes.push({
        productId: item.productId,
        productTitle: product.title,
        distance: round(distance),
        fee: itemFee
      });
    }

    const totalSubtotal = items.reduce((acc: number, item: any) => acc + (item.price || 0) * (item.quantity || 1), 0);

    return {
      totalDeliveryFee,
      itemQuotes,
      isFreeDelivery: false,
      subtotal: totalSubtotal
    };
  }
}
