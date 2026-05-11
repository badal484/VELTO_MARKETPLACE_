import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function purge() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || '');
    const db = mongoose.connection.db;
    if (!db) throw new Error('DB not connected');

    console.log('Fetching collections...');
    const collections = await db.listCollections().toArray();
    
    for (const col of collections) {
      const name = col.name;
      if (name === 'users') {
        console.log('Cleaning users (keeping admin)...');
        await db.collection(name).deleteMany({ role: { $ne: 'admin' } });
      } else if (['banners', 'zones', 'services'].includes(name)) {
        console.log(`Preserving collection: ${name}`);
        continue;
      } else {
        console.log(`Clearing collection: ${name}`);
        await db.collection(name).deleteMany({});
      }
    }

    console.log('--- PURGE COMPLETE ---');
    process.exit(0);
  } catch (error) {
    console.error('Error during purge:', error);
    process.exit(1);
  }
}

purge();
