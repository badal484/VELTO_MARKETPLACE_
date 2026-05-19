import dotenv from 'dotenv';
dotenv.config();
console.log('-------------------------------------------');
console.log(' VELTO SERVER: BOOTING UP...');
console.log('-------------------------------------------');
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { initSocket } from './socket/socket';


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
import locationRoutes from './routes/location';
import pharmacyRoutes from './routes/pharmacy';

// Global Model Registration to prevent Mongoose "Cold Start" Schema errors
import './models/index';
import { Banner } from './models/index';
import { Category } from '@shared/types';


import { errorHandler, notFound } from './middleware/errorHandler';


const app = express();
const httpServer = createServer(app);

initSocket(httpServer);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple Request Logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/', (_req, res) => res.json({ success: true, message: 'Velto API is running', version: '1.0.0' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

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
app.use('/api/location', locationRoutes);
app.use('/api/pharmacy', pharmacyRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 8082;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velto';
// Only force local fallback if we are NOT on Render/Production
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
const FINAL_MONGO_URI = MONGO_URI;
const MAX_MONGO_RETRIES = Number(process.env.MONGO_MAX_RETRIES || 10);
const MONGO_RETRY_DELAY_MS = Number(process.env.MONGO_RETRY_DELAY_MS || 5000);

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
import { PharmacyService } from './services/pharmacyService';
import { PharmacyCatalog } from './models/PharmacyCatalog';
import { pharmacySeedData } from './seed/pharmacyCatalog';

const connectMongoWithRetry = async () => {
  for (let attempt = 1; attempt <= MAX_MONGO_RETRIES; attempt++) {
    try {
      await mongoose.connect(FINAL_MONGO_URI);
      console.log('MongoDB connected');
      return;
    } catch (err: any) {
      const willRetry = attempt < MAX_MONGO_RETRIES;
      console.error(`MongoDB connection error (attempt ${attempt}/${MAX_MONGO_RETRIES}):`, err?.message || err);

      if (!willRetry) {
        throw err;
      }

      console.log(`Retrying MongoDB connection in ${MONGO_RETRY_DELAY_MS}ms...`);
      await new Promise((resolve) => setTimeout(resolve, MONGO_RETRY_DELAY_MS));
    }
  }
};

connectMongoWithRetry()
  .then(() => {
    httpServer.listen(PORT, '0.0.0.0', async () => {
      console.log(`Server running on all interfaces at port ${PORT}`);
      try {
        // Start background jobs & Seed
        await seedBanners();
        FundReleaseJob.init();

        // Pharmacy: seed catalog if empty, then recover any stale broadcasts
        const catalogCount = await PharmacyCatalog.countDocuments();
        if (catalogCount === 0) {
          console.log('[SEED] Seeding pharmacy catalog...');
          await PharmacyCatalog.insertMany(pharmacySeedData);
          console.log(`[SEED] ${pharmacySeedData.length} medicines seeded.`);
        }
        await PharmacyService.recoverStaleBroadcasts();

        console.log(' Velto Server fully initialized and ready.');
      } catch (err) {
        console.error(' CRITICAL ERROR DURING STARTUP JOBS:', err);
      }
    });
  })
  .catch((err) => {
    console.error('MongoDB failed to connect after retries:', err);
  });

// Global Error Catchers to prevent silent nodemon crashes
process.on('unhandledRejection', (reason, _promise) => {
  console.error('\n --- UNHANDLED REJECTION --- ');
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
