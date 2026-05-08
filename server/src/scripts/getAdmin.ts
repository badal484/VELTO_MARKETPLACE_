import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User';
import { Role } from '@shared/types';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velto';

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    const admin = await User.findOne({ role: Role.ADMIN });
    if (admin) {
      console.log('--- ADMIN CREDENTIALS ---');
      console.log('Email:', admin.email);
      console.log('Password: (Hashed in DB, usually Market@123 for seeds)');
      console.log('-------------------------');
    } else {
      console.log('No admin found. You may need to seed the DB.');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
