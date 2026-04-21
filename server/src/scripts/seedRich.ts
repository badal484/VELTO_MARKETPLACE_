import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { User } from '../models/User';
import { Shop } from '../models/Shop';
import { Product } from '../models/Product';
import { Role, Category } from '@shared/types';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velto';

const runSeed = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB Connected for Rich Seeding');

    // Wipe existing data
    await User.deleteMany({ role: { $ne: Role.ADMIN } });
    await Shop.deleteMany({});
    await Product.deleteMany({});

    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash('Market@123', salt);

    console.log('Creating Mock Sellers...');
    const sellers = await User.insertMany([
      {
        name: 'Arjun Electronics',
        email: 'arjun@electronics.com',
        password,
        role: Role.SELLER,
        phoneNumber: '9876543210'
      },
      {
        name: 'Lakshmi Organics',
        email: 'lakshmi@food.com',
        password,
        role: Role.SELLER,
        phoneNumber: '9876543211'
      },
      {
        name: 'Crafts & Decor',
        email: 'homedecor@shop.com',
        password,
        role: Role.SELLER,
        phoneNumber: '9876543212'
      }
    ]);

    console.log('Creating Verified Shops...');
    const shops = await Shop.insertMany([
      {
        owner: sellers[0]._id,
        name: 'Arjun Gadgets',
        businessName: 'Arjun Electronics Pvt Ltd',
        description: 'Latest gadgets and electronics in the heart of the city.',
        aadharCard: '123456789012',
        address: '123, 5th Block, Koramangala, Bangalore',
        detailedAddress: {
          street: '5th Block',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560095'
        },
        location: { type: 'Point', coordinates: [77.6245, 12.9352] },
        category: Category.ELECTRONICS,
        bankDetails: {
          holderName: 'Arjun K',
          bankName: 'ICICI Bank',
          accountNumber: '1234567890',
          ifscCode: 'ICIC0001234'
        },
        contactInfo: {
          businessEmail: 'contact@arjun.com',
          businessPhone: '9876543210'
        },
        isVerified: true,
        isTermsAccepted: true
      },
      {
        owner: sellers[1]._id,
        name: 'Lakshmi Natural Foods',
        businessName: 'Lakshmi Organics',
        description: 'Fresh organic produce delivered locally.',
        aadharCard: '123456789013',
        address: '45, Indiranagar, Bangalore',
        detailedAddress: {
          street: '100 Feet Road',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560038'
        },
        location: { type: 'Point', coordinates: [77.6412, 12.9716] },
        category: Category.FOOD,
        bankDetails: {
          holderName: 'Lakshmi R',
          bankName: 'HDFC Bank',
          accountNumber: '1234567891',
          ifscCode: 'HDFC0001234'
        },
        contactInfo: {
          businessEmail: 'order@lakshmi.com',
          businessPhone: '9876543211'
        },
        isVerified: true,
        isTermsAccepted: true
      }
    ]);

    console.log('Creating Mock Products...');
    await Product.insertMany([
      {
        seller: sellers[0]._id,
        shop: shops[0]._id,
        title: 'Premium Wireless Headphones',
        description: 'Noise cancelling, 40h battery life, sleek design.',
        price: 4999,
        category: Category.ELECTRONICS,
        images: [
          'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
          'https://images.unsplash.com/photo-1484154218962-a197022b5858',
          'https://images.unsplash.com/photo-1546435770-a3e426bf472b'
        ],
        stock: 15,
        location: { type: 'Point', coordinates: [77.6245, 12.9352] },
        isActive: true
      },
      {
        seller: sellers[0]._id,
        shop: shops[0]._id,
        title: 'Smart Watch Series X',
        description: 'Fitness tracking, heart rate monitor, AMOLED display.',
        price: 2999,
        category: Category.ELECTRONICS,
        images: [
          'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
          'https://images.unsplash.com/photo-1579586337278-3befd40fd17a',
          'https://images.unsplash.com/photo-1544117519-31a4b719223d'
        ],
        stock: 8,
        location: { type: 'Point', coordinates: [77.6245, 12.9352] },
        isActive: true
      },
      {
        seller: sellers[1]._id,
        shop: shops[1]._id,
        title: 'Organic Honey 500g',
        description: 'Raw, unfiltered honey collected from deep forests.',
        price: 450,
        category: Category.FOOD,
        images: [
          'https://images.unsplash.com/photo-1587049352846-4a222e784d38',
          'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62',
          'https://images.unsplash.com/photo-1555035336-11f81df6fa37'
        ],
        stock: 50,
        location: { type: 'Point', coordinates: [77.6412, 12.9716] },
        isActive: true
      }
    ]);

    console.log('Seeding Complete! Marketplace is now populated.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding Error:', error);
    process.exit(1);
  }
};

runSeed();