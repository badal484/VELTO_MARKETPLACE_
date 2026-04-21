import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Product } from '../models/Product';
import { Review } from '../models/Review';

dotenv.config();

const syncRatings = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/velto');
    console.log('--- CONNECTED TO MONGODB ---');

    const products = await Product.find({});
    console.log(`Found ${products.length} products to sync.`);

    for (const product of products) {
      const stats = await Review.aggregate([
        { $match: { product: product._id } },
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
        await Product.findByIdAndUpdate(product._id, {
          rating: Math.round(averageRating * 10) / 10,
          numReviews: count
        });
        console.log(`Synced: ${product.title} -> ${averageRating} stars (${count} reviews)`);
      } else {
        await Product.findByIdAndUpdate(product._id, {
          rating: 0,
          numReviews: 0
        });
        console.log(`Synced: ${product.title} -> 0 reviews`);
      }
    }

    console.log('--- SYNC COMPLETED SUCCESSFULLY ---');
    process.exit(0);
  } catch (error) {
    console.error('--- SYNC FAILED ---', error);
    process.exit(1);
  }
};

syncRatings();
