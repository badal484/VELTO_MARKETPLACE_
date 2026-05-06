import dotenv from 'dotenv';
dotenv.config();
console.log('-------------------------------------------');
console.log('🚀 VELTO SERVER: BOOTING UP...');
console.log('-------------------------------------------');
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { initSocket } from './socket/socket';

// Global Log Cache for remote debugging
const logCache: string[] = [];
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  logCache.push(`[${new Date().toLocaleTimeString()}] [LOG] ${msg}`);
  if (logCache.length > 50) logCache.shift();
  originalLog.apply(console, args);
};

console.error = (...args) => {
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  logCache.push(`[${new Date().toLocaleTimeString()}] [ERR] ${msg}`);
  if (logCache.length > 50) logCache.shift();
  originalError.apply(console, args);
};

import authRoutes from './routes/auth';
import shopRoutes from './routes/shop';
import productRoutes from './routes/product';
import chatRoutes from './routes/chat';
import adminRoutes from './routes/admin';
import orderRoutes from './routes/order';
import uploadRoutes from './routes/upload';
import cartRoutes from './routes/cart';
import wishlistRoutes from './routes/wishlist';
import reviewRoutes from './routes/reviewRoutes';
import notificationRoutes from './routes/notification';
import userRoutes from './routes/user';
import paymentRoutes from './routes/payment';
import payoutRoutes from './routes/payout';
import bannerRoutes from './routes/bannerRoutes';
import zoneRoutes from './routes/zone';

// Global Model Registration to prevent Mongoose "Cold Start" Schema errors
import './models/index';
import { User, Shop, Product, Banner } from './models/index';
import { Category } from '@shared/types';


import { errorHandler, notFound } from './middleware/errorHandler';


const app = express();
const httpServer = createServer(app);

initSocket(httpServer);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Diagnostic endpoint
app.get('/api/debug/count', async (req, res) => {
  const userCount = await User.countDocuments();
  const shopCount = await Shop.countDocuments();
  const productCount = await Product.countDocuments();
  const verifiedShopCount = await Shop.countDocuments({ isVerified: true });
  
  res.json({
    users: userCount,
    shops: shopCount,
    verifiedShops: verifiedShopCount,
    products: productCount
  });
});

app.get('/', (_req, res) => res.json({ success: true, message: 'Velto API is running', version: '1.0.0' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Remote Log Viewer for debugging production issues
app.get('/api/debug/logs', (req, res) => {
  const logs = [...logCache].reverse();
  res.send(`
    <html>
      <body style="background: #1e1e1e; color: #d4d4d4; font-family: monospace; padding: 20px;">
        <h2>🚀 Velto Server Logs (Last 50)</h2>
        <div style="border: 1px solid #333; padding: 10px; background: #000;">
          ${logs.map(log => `<div style="margin-bottom: 5px; border-bottom: 1px solid #222; padding-bottom: 2px;">${log}</div>`).join('')}
        </div>
        <script>setTimeout(() => location.reload(), 5000);</script>
      </body>
    </html>
  `);
});

app.use('/api/auth', authRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/products', productRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/user', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/zones', zoneRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 8082;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velto';

// Auto-seed banners if empty
const seedBanners = async () => {
  const count = await Banner.countDocuments();
  if (count === 0) {
    console.log('[SEED] No banners found. Seeding defaults...');
    await Banner.insertMany([
      {
        title: 'Express Delivery',
        subtitle: 'Fresh from local farms to your door',
        imageUrl: 'https://images.unsplash.com/photo-1586880244406-5569bc3d5f00?auto=format&fit=crop&q=80&w=1200',
        category: Category.FOOD,
        isActive: true
      },
      {
        title: 'Grocery Savings',
        subtitle: 'Up to 25% off on daily essentials',
        imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1200',
        category: Category.FOOD,
        isActive: true
      },
      {
        title: 'Smart Tech',
        subtitle: 'Latest gadgets for your living space',
        imageUrl: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80&w=1200',
        category: Category.ELECTRONICS,
        isActive: true
      },
      {
        title: 'New Collections',
        subtitle: 'Elevate your style with minimalist fashion',
        imageUrl: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&q=80&w=1200',
        category: Category.CLOTHING,
        isActive: true
      }
    ]);
    console.log('[SEED] Banners seeded successfully.');
  }
};

import { FundReleaseJob } from './services/fundReleaseJob';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    httpServer.listen(PORT, '0.0.0.0', async () => {
      console.log(`Server running on all interfaces at port ${PORT}`);
      try {
        // Start background jobs & Seed
        await seedBanners();
        FundReleaseJob.init();
        console.log('🚀 Velto Server fully initialized and ready.');
      } catch (err) {
        console.error('❌ CRITICAL ERROR DURING STARTUP JOBS:', err);
      }
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });

// Global Error Catchers to prevent silent nodemon crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n🚫 --- UNHANDLED REJECTION --- 🚫');
  console.error('Reason:', reason instanceof Error ? reason.stack : reason);
  console.error('-------------------------------\n');
});

process.on('uncaughtException', (error) => {
  console.error('\n --- UNCAUGHT EXCEPTION --- ');
  console.error(error.stack || error);
  console.error('-------------------------------\n');
  // Give it a longer window to ensure logs are flushed to terminal/disk
  setTimeout(() => process.exit(1), 2000);
});