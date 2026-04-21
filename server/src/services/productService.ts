import { Product } from '../models/Product';
import { Shop } from '../models/Shop';
import { Wishlist } from '../models/Wishlist';
import { uploadImage } from '../utils/imagekit';
import { PipelineStage } from 'mongoose';

export class ProductService {
  static async createProduct(ownerId: string, data: any, files: any[]) {
    const shop = await Shop.findOne({ owner: ownerId });
    if (!shop || !shop.isVerified) {
      throw new Error('Must have a verified shop to add listings');
    }

    let imageUrls = data.images || [];

    if (files && files.length > 0) {
      if (files.length < 3) throw new Error('Must provide at least 3 images');
      imageUrls = await Promise.all(
        files.map((file, index) => uploadImage(file.buffer, `product_${Date.now()}_${index}`))
      );
    } else if (imageUrls.length < 3) {
      // Fallback for simulation or external API usage
       throw new Error('Must provide at least 3 images');
    }

    return await Product.create({
      ...data,
      seller: ownerId,
      shop: shop._id,
      images: imageUrls,
      location: {
        type: 'Point',
        coordinates: [parseFloat(data.lng), parseFloat(data.lat)]
      }
    });
  }

  static async getDiscoveryProducts(userId: string | undefined, filters: any) {
    const { lat, lng, radius, search, category, minPrice, maxPrice } = filters;
    const pipeline: PipelineStage[] = [];

    // Product-level filters applied at geo/match stage (search applied post-join to include shop fields)
    const query: any = { isActive: true };
    if (category) query.category = category;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (lat && lng) {
      const useGlobal = filters.global === 'true' || filters.global === true;
      pipeline.push({
        $geoNear: {
          near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          distanceField: 'distance',
          spherical: true,
          query,
          maxDistance: useGlobal ? 50000000 : (radius ? Number(radius) * 1000 : 100000)
        }
      });
    } else {
      pipeline.push({ $match: query });
    }

    pipeline.push(
      { $lookup: { from: 'shops', localField: 'shop', foreignField: '_id', as: 'shopInfo' } },
      { $unwind: '$shopInfo' },
      { $match: { 'shopInfo.isVerified': true } },
    );

    // Search across product title/description, shop name, and location (city/address)
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      pipeline.push({
        $match: {
          $or: [
            { title: searchRegex },
            { description: searchRegex },
            { 'shopInfo.name': searchRegex },
            { 'shopInfo.detailedAddress.city': searchRegex },
            { 'shopInfo.address': searchRegex },
          ]
        }
      });
    }

    pipeline.push(
      {
        $addFields: {
          isNearby: { $lte: ['$distance', 5000] },
          shop: '$shopInfo'
        }
      },
      { $sort: { isNearby: -1, createdAt: -1 } }
    );

    let wishlistedIds: string[] = [];
    if (userId) {
      const wishlist = await Wishlist.findOne({ user: userId });
      if (wishlist) wishlistedIds = wishlist.products.map(id => id.toString());
    }

    const products = await Product.aggregate(pipeline);
    return products.map(p => ({
      ...p,
      isWishlisted: wishlistedIds.includes(p._id.toString()),
      distance: p.distance ? parseFloat((p.distance / 1000).toFixed(1)) : undefined
    }));
  }
}
