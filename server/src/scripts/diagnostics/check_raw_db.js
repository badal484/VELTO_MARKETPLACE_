const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const shopSchema = new mongoose.Schema({
  name: String,
  businessName: String,
  aadharCard: String,
  detailedAddress: Object,
  bankDetails: Object,
  isVerified: { type: Boolean, default: false }
}, { strict: false });

const Shop = mongoose.model('Shop', shopSchema);

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('--- CONNECTED ---');
  const shops = await Shop.find({ isVerified: false });
  console.log(`Found ${shops.length} pending shops`);
  
  shops.forEach(s => {
    console.log(`ID: ${s._id}`);
    console.log(`Name: ${s.name}`);
    console.log(`BizName: ${s.businessName}`);
    console.log(`Aadhar: ${s.aadharCard}`);
    console.log(`Details:`, JSON.stringify(s.detailedAddress, null, 2));
    console.log(`Bank:`, JSON.stringify(s.bankDetails, null, 2));
    console.log('------------------');
  });
  
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});