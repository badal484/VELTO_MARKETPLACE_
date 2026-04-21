import axios from 'axios';

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
      const response = await axios.get(
        'https://api.geoapify.com/v1/geocode/autocomplete',
        {
          params: {
            text: query,
            filter: `rect:${KARNATAKA_RECT}`,
            limit: 5,
            apiKey: GEOAPIFY_API_KEY,
          },
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
      console.error('Location search error:', error);
      return [];
    }
  },

  reverseGeocode: async (
    lat: number,
    lon: number,
  ): Promise<LocationResult | null> => {
    try {
      const response = await axios.get(
        'https://api.geoapify.com/v1/geocode/reverse',
        {
          params: {
            lat,
            lon,
            apiKey: GEOAPIFY_API_KEY,
          },
        },
      );

      if (response.data.features.length > 0) {
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
      return null;
    } catch (error) {
      console.error('Reverse geocode error:', error);
      return null;
    }
  },
};
