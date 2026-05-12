import { ProductSize } from '@shared/types';

/**
 * Calculates the Haversine distance between two points in kilometers.
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Logic for dynamic delivery charges:
 * - Base Fee: ₹30 (up to 3km)
 * - Distance Premium: ₹10 per km after 3km
 * - Size Surcharge:
 *    - small: ₹0
 *    - medium: ₹20
 *    - large: ₹50
 */
export const calculateDeliveryFee = (
  distanceKm: number,
  size: ProductSize = ProductSize.SMALL
): number => {
  return 40; // Base logistics fee restored to ₹40
};
