import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User';
import { Role } from '@shared/types';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velto';

const runFix = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for Branding Fix');

    // 1. Find and Rename NexBuy Admin to Velto Support Team
    const adminRename = await User.updateMany(
      { role: Role.ADMIN, name: { $regex: /NexBuy/i } },
      { $set: { name: 'Velto Support Team' } }
    );
    console.log(`Updated ${adminRename.modifiedCount} Admin user(s) to 'Velto Support Team'`);

    // 2. Catch-all: Rename any user containing NexBuy
    const generalRename = await User.updateMany(
      { name: { $regex: /NexBuy/i } },
      { $set: { name: 'Velto User' } }
    );
    console.log(`Updated ${generalRename.modifiedCount} other users containing 'NexBuy'`);

    console.log('Database branding fix complete.');
    process.exit(0);
  } catch (error) {
    console.error('Fix Error:', error);
    process.exit(1);
  }
};

runFix();
