import mongoose from 'mongoose';
import express from 'express';
import { ServiceZone } from '../models/ServiceZone';
import { handleError } from '../utils/errors';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velto';

async function test() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected');
    
    // Simulate the controller logic
    const zones = await ServiceZone.find().sort({ createdAt: -1 });
    console.log('SUCCESS: Zones found:', zones.length);
    
    process.exit(0);
  } catch (err: any) {
    console.error('CRASH DETECTED:');
    console.error(err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

test();
