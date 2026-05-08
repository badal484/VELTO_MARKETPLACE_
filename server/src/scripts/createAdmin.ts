import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Role } from '@shared/types';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velto';

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    const existing = await User.findOne({ email: 'admin@velto.com' });
    if (existing) {
       console.log('Admin already exists.');
       process.exit(0);
    }
    
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    await User.create({
      name: 'Super Admin',
      email: 'admin@velto.com',
      password: hashedPassword,
      role: Role.ADMIN,
      isVerified: true
    });
    
    console.log('--- ADMIN CREATED ---');
    console.log('Email: admin@velto.com');
    console.log('Password: Admin@123');
    console.log('---------------------');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
