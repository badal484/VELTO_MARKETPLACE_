import mongoose from 'mongoose';
import { Banner } from './src/models/Banner';
import { Category } from '@shared/types';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velto';

const oldBanners = [
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
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for seeding...');
    
    // Clear existing to avoid duplicates if re-run
    await Banner.deleteMany({});
    
    await Banner.insertMany(oldBanners);
    console.log('Successfully seeded 4 premium banners!');
    
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
