import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { Notification } from '../models/Notification';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velto';

const dedupeOrders = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    // 1. Find all buyers who have placed orders recently
    const buyers = await Order.distinct('buyer');
    console.log(`Analyzing orders for ${buyers.length} buyers...`);

    let totalCleaned = 0;

    for (const buyerId of buyers) {
      const orders = await Order.find({ buyer: buyerId }).sort({ createdAt: -1 });
      
      // Group orders by Product and "Approximate Time" (within 2 minutes)
      const groups: Record<string, any[]> = {};

      for (const order of orders) {
        // Create a key: ProductId + TimeBucket (5 min chunks)
        const timeBucket = Math.floor(new Date(order.createdAt).getTime() / (1000 * 60 * 5));
        const key = `${order.product.toString()}_${timeBucket}`;
        
        if (!groups[key]) groups[key] = [];
        groups[key].push(order);
      }

      for (const key in groups) {
        const group = groups[key];
        if (group.length > 1) {
          console.log(`Found ${group.length} duplicates for product ${group[0].productSnapshot.title}`);
          
          const master = group[0];
          const duplicates = group.slice(1);

          for (const duplicate of duplicates) {
            // Merge quantity into master
            master.quantity += duplicate.quantity;
            master.totalPrice += duplicate.totalPrice;

            // Delete duplicate order
            await Order.findByIdAndDelete(duplicate._id);

            // Delete associated conversations, messages, and notifications
            await Conversation.deleteMany({ order: duplicate._id });
            await Message.deleteMany({ conversationId: { $in: await Conversation.find({ order: duplicate._id }).distinct('_id') } });
            await Notification.deleteMany({ 'data.orderId': duplicate._id });

            totalCleaned++;
          }
          
          await master.save();
          console.log(`Merged duplicates into master order ${master._id}. New Quantity: ${master.quantity}`);
        }
      }
    }

    console.log(`\nCleanup complete. Removed/Merged ${totalCleaned} duplicate entries.`);
    process.exit(0);
  } catch (err) {
    console.error('Error during de-duplication:', err);
    process.exit(1);
  }
};

dedupeOrders();