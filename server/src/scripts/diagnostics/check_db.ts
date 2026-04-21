import mongoose from 'mongoose';
import { Shop } from './server/src/models/Shop';
import dotenv from 'dotenv';

dotenv.config({ path: './server/.env' });

async function checkPendingShops() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('Connected to DB');
  
  const shops = await Shop.find({ isVerified: false });
  console.log(`Found ${shops.length} pending shops`);
  
  shops.forEach(shop => {
    console.log('--- Shop ---');
    console.log(`Name: ${shop.name}`);
    console.log(`Business Name: ${shop.businessName}`);
    console.log(`Aadhar: ${shop.aadharCard}`);
    console.log(`Bank Details:`, shop.bankDetails);
    console.log(`Address:`, shop.detailedAddress);
  });
  
  await mongoose.disconnect();
}

checkPendingShops();
