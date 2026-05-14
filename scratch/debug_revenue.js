const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });

async function debugRevenue() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velto';
  await mongoose.connect(MONGO_URI);
  
  // Dynamically load models
  const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
  const PlatformRevenue = mongoose.model('PlatformRevenue', new mongoose.Schema({}, { strict: false }));

  const completedOrders = await Order.find({ status: 'Completed' });
  console.log('--- COMPLETED ORDERS ---');
  let totalRevenue = 0;
  for (const o of completedOrders) {
    console.log(`Order ID: ${o._id}, Price: ₹${o.totalPrice}, Method: ${o.paymentMethod}`);
    totalRevenue += o.totalPrice;
  }
  console.log(`Calculated Total Revenue: ₹${totalRevenue}`);

  const revenueDocs = await PlatformRevenue.find({});
  console.log('\n--- PLATFORM REVENUE DOCS ---');
  let totalComm = 0;
  let totalExp = 0;
  for (const r of revenueDocs) {
    console.log(`Order: ${r.orderId}, Seller Comm: ₹${r.sellerCommission}, Rider Comm: ₹${r.riderCommission}, Exp: ₹${r.expenseAmount}`);
    totalComm += (r.totalCommission || 0);
    totalExp += (r.expenseAmount || 0);
  }
  console.log(`Total Commission: ₹${totalComm}`);
  console.log(`Total Expenses: ₹${totalExp}`);
  console.log(`Net Revenue (Velto Share): ₹${totalComm - totalExp}`);

  await mongoose.disconnect();
}

debugRevenue().catch(console.error);
