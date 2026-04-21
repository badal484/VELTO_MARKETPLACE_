import mongoose from 'mongoose';
import { Product } from '../models/Product';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const fixStock = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log('Connected to MongoDB');

    const result = await Product.updateMany(
      { title: "IPHONE 15" },
      { $set: { stock: 50, isActive: true } }
    );

    console.log(`Successfully updated STOCK for ${result.modifiedCount} products matching "IPHONE 15".`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Fix Stock Error:', err);
    process.exit(1);
  }
};

fixStock();
