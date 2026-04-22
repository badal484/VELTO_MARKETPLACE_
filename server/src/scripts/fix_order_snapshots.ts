import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Order } from '../models/Order';
import { Product } from '../models/Product';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function fixSnapshots() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velto';
  
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    // We use lean() to get raw objects and avoid Mongoose validation triggers during the find
    const orders = await Order.find({}).lean();

    console.log(`Analyzing ${orders.length} orders...`);

    let successCount = 0;
    for (const order of orders) {
      const updates: any = {};
      
      // 1. Fix Product Snapshot
      if (!order.productSnapshot || !order.productSnapshot.title) {
        const product = await Product.findById(order.product);
        if (product) {
          updates.productSnapshot = {
            title: product.title,
            image: product.images[0] || '',
            originalPrice: product.price,
            category: product.category
          };
        } else {
          updates.productSnapshot = {
            title: 'Legacy Product',
            image: '',
            originalPrice: order.totalPrice || 0,
            category: 'Other'
          };
        }
      }

      // 2. Fix other missing required fields that block status updates
      if (!order.pickupCode) {
        updates.pickupCode = Math.floor(1000 + Math.random() * 9000).toString();
      }
      if (!order.buyerPhone) {
        updates.buyerPhone = '0000000000';
      }

      if (Object.keys(updates).length > 0) {
        // Use the underlying collection to BYPASS Mongoose validation
        // This allows us to fix the data without getting blocked by the validation errors we are trying to fix!
        await Order.collection.updateOne(
          { _id: order._id },
          { $set: updates }
        );
        successCount++;
        console.log(`✅ Fixed order ${order._id}: ${Object.keys(updates).join(', ')}`);
      }
    }

    console.log(`Successfully repaired ${successCount} orders.`);
    
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

fixSnapshots();