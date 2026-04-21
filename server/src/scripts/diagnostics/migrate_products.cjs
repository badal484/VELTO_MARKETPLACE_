const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const db = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/velto';

async function run() {
  try {
    console.log('Connecting to', db.replace(/:([^:@]+)@/, ':****@')); // Hide password in logs
    await mongoose.connect(db);
    console.log('Connected.');

    const products = await mongoose.connection.db.collection('products').find({
      $or: [
        { shop: { $exists: false } },
        { shop: null }
      ]
    }).toArray();

    console.log(`Found ${products.length} products to fix.`);

    for (const p of products) {
      const shop = await mongoose.connection.db.collection('shops').findOne({ owner: p.seller });
      if (shop) {
        await mongoose.connection.db.collection('products').updateOne(
          { _id: p._id },
          { $set: { shop: shop._id } }
        );
        console.log(`Linked product "${p.title}" to shop "${shop.name}"`);
      } else {
        console.log(`No shop found for seller ${p.seller} of product "${p.title}"`);
      }
    }

    console.log('Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();