import { Shop } from '../models/Shop';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { uploadImage } from '../utils/imagekit';
import { AppError } from '../utils/errors';
import { io } from '../socket/socket';
import { SocketEvent } from '@shared/constants/socketEvents';

export class ShopService {
  static async createShop(owner: string, data: any, file?: any) {
    const existingShop = await Shop.findOne({ owner });
    if (existingShop) {
      throw new AppError('You already have a shop registered', 400);
    }

    let logoUrl = data.logo;
    if (file) {
      logoUrl = await uploadImage(file.buffer, `shop_logo_${Date.now()}`);
    }

    const { location: locationData, ...rest } = data;
    const lat = locationData?.lat ?? 0;
    const lng = locationData?.lng ?? 0;

    const shop = await Shop.create({
      ...rest,
      location: {
        type: 'Point',
        coordinates: [Number(lng), Number(lat)],
      },
      owner,
      logo: logoUrl,
      isVerified: false,
    });

    // Notify admins about new shop application
    io.emit(SocketEvent.NEW_APPLICATION, { type: 'shop', name: shop.name });

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
    if (!shop) throw new AppError('Shop not found', 404);
    if (shop.owner.toString() !== owner) throw new AppError('Not authorized to edit this shop', 403);

    if (file) {
      data.logo = await uploadImage(file.buffer, `shop_logo_${Date.now()}`);
    }

    const { location: locationData, ...rest } = data;
    const updateData: any = {
      ...rest,
      isVerified: false,
      rejectionReason: undefined,
    };

    if (locationData?.lat !== undefined && locationData?.lng !== undefined) {
      updateData.location = {
        type: 'Point',
        coordinates: [Number(locationData.lng), Number(locationData.lat)],
      };
    }

    return await Shop.findByIdAndUpdate(shopId, updateData, { new: true });
  }
}
