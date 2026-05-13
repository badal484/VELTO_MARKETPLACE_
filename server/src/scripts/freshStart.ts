import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/velto';

async function resetStats() {
  try {
    console.log('--- VELTO FRESH START INITIATED ---');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    const db = mongoose.connection.db;

    // 1. Delete all transactional data
    console.log('Cleaning up orders...');
    await db.collection('orders').deleteMany({});
    
    console.log('Cleaning up wallet transactions...');
    await db.collection('wallettransactions').deleteMany({});
    
    console.log('Cleaning up payout requests...');
    await db.collection('payoutrequests').deleteMany({});

    console.log('Cleaning up conversations and messages...');
    await db.collection('conversations').deleteMany({});
    await db.collection('messages').deleteMany({});

    console.log('Cleaning up notifications...');
    await db.collection('notifications').deleteMany({});

    console.log('Cleaning up reviews...');
    await db.collection('reviews').deleteMany({});

    console.log('Cleaning up carts and wishlists...');
    await db.collection('carts').deleteMany({});
    await db.collection('wishlists').deleteMany({});

    // 2. Reset User balances and Rider stats
    console.log('Resetting user wallet balances and cash-in-hand...');
    await db.collection('users').updateMany(
      {},
      { 
        $set: { 
          walletBalance: 0, 
          cashInHand: 0 
        } 
      }
    );

    // 3. Optional: Reset product ratings/views if needed, but keeping products
    console.log('Resetting product views...');
    await db.collection('products').updateMany(
      {},
      { $set: { views: 0, rating: 0, numReviews: 0 } }
    );

    console.log('\n--- RESET COMPLETE ---');
    console.log('Preserved: Users, Riders, Shops, Products, Banners, and Zones.');
    console.log('Cleared: Orders, Chats, Revenue, and Transactions.');

    process.exit(0);
  } catch (error) {
    console.error('Reset failed:', error);
    process.exit(1);
  }
}

resetStats();
