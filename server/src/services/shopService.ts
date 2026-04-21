import { Shop } from '../models/Shop';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { uploadImage } from '../utils/imagekit';

export class ShopService {
  static async createShop(owner: string, data: any, file?: any) {
    const existingShop = await Shop.findOne({ owner });
    if (existingShop) {
      throw new Error('User already owns a shop');
    }

    let logoUrl = data.logo;
    if (file) {
      logoUrl = await uploadImage(file.buffer, `shop_logo_${Date.now()}`);
    }

    const { lat, lng, ...rest } = data;

    const shop = await Shop.create({
      ...rest,
      location: {
        type: 'Point',
        coordinates: [Number(lng), Number(lat)]
      },
      owner,
      logo: logoUrl,
      isVerified: false
    });

    return shop;
  }

  static async getShopStats(shopId: string) {
    const [productCount, salesData, ratingData] = await Promise.all([
      Product.countDocuments({ shop: shopId, isActive: true }),
      Order.aggregate([
        { $match: { shop: shopId } },
        { 
          $group: { 
            _id: null, 
            total: { $sum: 1 }, 
            completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } } 
          } 
        }
      ]),
      Product.aggregate([
        { $match: { shop: shopId, isActive: true } },
        { $group: { _id: null, avgRating: { $avg: "$rating" } } }
      ])
    ]);

    const completed = salesData[0]?.completed || 0;
    const total = salesData[0]?.total || 0;

    return {
      productCount,
      completedOrders: completed,
      totalOrders: total,
      avgRating: ratingData[0]?.avgRating ? Math.round(ratingData[0].avgRating * 10) / 10 : 0,
      reliabilityScore: total > 0 ? Math.round((completed / total) * 100) : 100
    };
  }

  static async editShop(shopId: string, owner: string, data: any, file?: any) {
    const shop = await Shop.findById(shopId);
    if (!shop) throw new Error('Shop not found');
    if (shop.owner.toString() !== owner) throw new Error('Not authorized');

    if (file) {
      data.logo = await uploadImage(file.buffer, `shop_logo_${Date.now()}`);
    }

    // Reset verification on significant changes
    data.isVerified = false;
    data.rejectionReason = undefined;

    return await Shop.findByIdAndUpdate(shopId, data, { new: true });
  }
}
