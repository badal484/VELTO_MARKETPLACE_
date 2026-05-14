import mongoose from 'mongoose';
import { Order } from './server/src/models/Order';
import { PlatformRevenue } from './server/src/models/PlatformRevenue';
import { OrderStatus } from './shared/types';

async function debugRevenue() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velto');
  
  const completedOrders = await Order.find({ status: OrderStatus.COMPLETED });
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
    totalComm += r.totalCommission;
    totalExp += r.expenseAmount || 0;
  }
  console.log(`Total Commission: ₹${totalComm}`);
  console.log(`Total Expenses: ₹${totalExp}`);
  console.log(`Net Revenue (Velto Share): ₹${totalComm - totalExp}`);

  await mongoose.disconnect();
}

debugRevenue().catch(console.error);
