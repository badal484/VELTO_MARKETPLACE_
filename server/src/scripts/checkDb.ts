import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velto';

async function checkDb() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    // Check Zones
    const zones = await mongoose.connection.db.collection('servicezones').find({}).toArray();
    console.log('Zones Count:', zones.length);
    console.log('Sample Zone:', zones[0]);
    
    // Check Transactions
    const txs = await mongoose.connection.db.collection('wallettransactions').find({}).toArray();
    console.log('Transactions Count:', txs.length);
    
    process.exit(0);
  } catch (err) {
    console.error('Check DB Error:', err);
    process.exit(1);
  }
}

checkDb();
