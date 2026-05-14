import axios from 'axios';
import { axiosInstance } from '../api/axiosInstance';

const GEOAPIFY_API_KEY = '789e61f213884a45ba3d595a0c128381';
const KARNATAKA_RECT = '74.0,11.5,78.6,18.5'; // [lon_min, lat_min, lon_max, lat_max]

export interface LocationResult {
  formatted: string;
  lat: number;
  lon: number;
  place_id: string;
  street?: string;
  city?: string;
  state?: string;
  postcode?: string;
}

export const locationService = {
  searchLocations: async (query: string): Promise<LocationResult[]> => {
    if (!query || query.length < 3) {
      return [];
    }

    try {
      // Primary: Backend Proxy (which has reliable internet access)
      const response = await axiosInstance.get('/api/location/search', {
        params: { text: query }
      });
      return response.data.data;
    } catch (error) {
      console.log('Location search proxy failed, trying direct Geoapify...', (error as any).message);
    }

    try {
      // Secondary: Direct Geoapify (Original logic)
      const response = await axios.get(
        'https://api.geoapify.com/v1/geocode/autocomplete',
        {
          params: {
            text: query,
            filter: 'countrycode:in',
            limit: 5,
            apiKey: GEOAPIFY_API_KEY,
          },
          timeout: 5000,
        },
      );

      return response.data.features.map((feature: any) => ({
        formatted: feature.properties.formatted,
        lat: feature.properties.lat,
        lon: feature.properties.lon,
        place_id: feature.properties.place_id,
        street: feature.properties.street,
        city: feature.properties.city,
        state: feature.properties.state,
        postcode: feature.properties.postcode,
      }));
    } catch (error) {
      console.log('Location search error (likely network):', (error as any).message);
      return [];
    }
  },

  reverseGeocode: async (
    lat: number,
    lon: number,
  ): Promise<LocationResult | null> => {
    try {
      // Primary: Backend Proxy
      const response = await axiosInstance.get('/api/location/reverse', {
        params: { lat, lon }
      });
      if (response.data.success) {
        return response.data.data;
      }
    } catch (error) {
      console.log('Backend reverse geocode proxy failed, trying direct Geoapify...', (error as any).message);
    }

    try {
      // Secondary: Direct Geoapify
      const response = await axios.get(
        'https://api.geoapify.com/v1/geocode/reverse',
        {
          params: {
            lat,
            lon,
            apiKey: GEOAPIFY_API_KEY,
          },
          timeout: 5000,
        },
      );

      if (response.data.features && response.data.features.length > 0) {
        const feature = response.data.features[0];
        return {
          formatted: feature.properties.formatted,
          lat: feature.properties.lat,
          lon: feature.properties.lon,
          place_id: feature.properties.place_id,
          street: feature.properties.street,
          city: feature.properties.city,
          state: feature.properties.state,
          postcode: feature.properties.postcode,
        };
      }
    } catch (error) {
      console.log('Geoapify reverse geocode failed, trying fallback...', (error as any).message);
    }

    try {
      // Fallback: Nominatim (OpenStreetMap)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'VeltoMarketplace/1.0',
          },
        }
      );
      const data = await response.json();
      
      if (data && data.display_name) {
        return {
          formatted: data.display_name,
          lat: Number(data.lat),
          lon: Number(data.lon),
          place_id: String(data.place_id),
          street: data.address.road || data.address.pedestrian,
          city: data.address.city || data.address.town || data.address.village,
          state: data.address.state,
          postcode: data.address.postcode,
        };
      }
    } catch (fallbackError) {
      console.log('Location fallback failed:', (fallbackError as any).message);
    }

    return null;
  },
};
