import mongoose from 'mongoose';
import { Product } from '../src/models/Product';
import { Shop } from '../src/models/Shop';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testAggregation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const latVal = 12.9716; // Example Bangalore lat
    const lngVal = 77.5946; // Example Bangalore lng
    const radiusVal = 20000;
    const search = '';
    const category = '';
    const minPrice = '';
    const maxPrice = '';

    const pipeline: any[] = [];
    const query: any = { isActive: true };
    
    // Build query similar to productController.ts
    const hasLocation = latVal !== null && lngVal !== null && !isNaN(latVal) && !isNaN(lngVal);

    if (hasLocation) {
      const geoNearStage: any = {
        near: { type: 'Point', coordinates: [lngVal, latVal] },
        distanceField: 'distance',
        spherical: true,
        query: query
      };
      if (radiusVal < 100) {
        geoNearStage.maxDistance = radiusVal * 1000;
      }
      pipeline.push({ $geoNear: geoNearStage });
    } else {
      pipeline.push({ $match: query });
    }

    pipeline.push({
      $lookup: {
        from: 'shops',
        localField: 'shop',
        foreignField: '_id',
        as: 'shopDetails'
      }
    });

    pipeline.push({
      $unwind: { path: '$shopDetails', preserveNullAndEmptyArrays: true }
    });

    pipeline.push({
      $match: { 'shopDetails.isVerified': true }
    });

    pipeline.push({ $addFields: { isNearby: true } }); // Simplification for test
    pipeline.push({ $sort: { isNearby: -1, distance: 1 } });

    console.log('Executing pipeline:', JSON.stringify(pipeline, null, 2));
    const results = await Product.aggregate(pipeline);
    console.log('Aggregation successful. Count:', results.length);
    process.exit(0);
  } catch (error) {
    console.error('AGGREGATION FAILED:');
    console.error(error);
    process.exit(1);
  }
}

testAggregation();