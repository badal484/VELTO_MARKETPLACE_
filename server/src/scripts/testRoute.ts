import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ZoneService } from '../services/ZoneService';
import { WalletTransaction } from '../models/WalletTransaction';
import { ServiceZone } from '../models/ServiceZone';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velto';

async function test() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected');
    
    // Register all models explicitly to avoid population errors
    require('../models/User');
    require('../models/Order');
    require('../models/PayoutRequest');
    
    console.log('Testing getAllZones...');
    const zones = await ZoneService.getAllZones();
    console.log('Zones:', zones.length);
    
    console.log('Testing getAllTransactions...');
    const txs = await WalletTransaction.find({})
      .populate('user', 'name email')
      .populate('orderId', 'status')
      .sort({ createdAt: -1 });
    console.log('Transactions:', txs.length);
    
    process.exit(0);
  } catch (err: any) {
    console.error('TEST FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

test();
