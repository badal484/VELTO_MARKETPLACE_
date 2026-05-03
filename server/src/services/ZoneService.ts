import { ServiceZone } from '../models/ServiceZone';
import { AppError } from '../utils/errors';

export class ZoneService {
  /**
   * Checks if a specific location [lng, lat] is covered by any active service zone.
   * Returns the zone if found, otherwise null.
   */
  static async checkServiceability(lng: number, lat: number) {
    const zones = await ServiceZone.find({ isActive: true });
    
    for (const zone of zones) {
      const distance = this.calculateDistance(
        lat, lng, 
        zone.center.coordinates[1], zone.center.coordinates[0]
      );
      
      if (distance <= zone.radius) {
        return zone;
      }
    }
    
    return null;
  }

  /**
   * Returns the service radius (in meters) for a given coordinate.
   * If not serviceable, returns 0.
   */
  static async getServiceRadius(lng: number, lat: number): Promise<number> {
    const zone = await this.checkServiceability(lng, lat);
    return zone ? zone.radius * 1000 : 0; // Convert KM to Meters
  }

  /**
   * Haversine formula to calculate distance between two points in KM.
   */
  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  static async getActiveZones() {
    return await ServiceZone.find({ isActive: true }).sort({ name: 1 });
  }

  static async getAllZones() {
    return await ServiceZone.find().sort({ createdAt: -1 });
  }

  static async createZone(data: any) {
    return await ServiceZone.create(data);
  }

  static async updateZone(id: string, data: any) {
    const zone = await ServiceZone.findByIdAndUpdate(id, data, { new: true });
    if (!zone) throw new AppError('Zone not found', 404);
    return zone;
  }

  static async deleteZone(id: string) {
    const zone = await ServiceZone.findByIdAndDelete(id);
    if (!zone) throw new AppError('Zone not found', 404);
    return zone;
  }
}
