import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Order } from '../models/Order';
import { Review } from '../models/Review';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velto';

const fixOrders = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const reviews = await Review.find({});
    console.log(`Found ${reviews.length} reviews`);

    let updatedCount = 0;
    for (const review of reviews) {
      if (review.order) {
        const res = await Order.findByIdAndUpdate(review.order, { isReviewed: true });
        if (res) updatedCount++;
      }
    }

    // Also set isReviewed: false for all orders that don't have the field
    const res = await Order.updateMany(
      { isReviewed: { $exists: false } },
      { $set: { isReviewed: false } }
    );
    
    console.log(`Updated ${updatedCount} orders based on reviews`);
    console.log(`Set isReviewed=false for ${res.modifiedCount} old orders`);

    await mongoose.disconnect();
    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error('Error fixing orders:', err);
    process.exit(1);
  }
};

fixOrders();
