import { Request, Response } from 'express';
import axios from 'axios';
import { handleError } from '../utils/errors';

const GEOAPIFY_API_KEY = '789e61f213884a45ba3d595a0c128381';

export const reverseGeocode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      res.status(400).json({ success: false, message: 'lat and lon are required' });
      return;
    }

    const response = await axios.get(
      'https://api.geoapify.com/v1/geocode/reverse',
      {
        params: {
          lat,
          lon,
          apiKey: GEOAPIFY_API_KEY,
        },
        timeout: 5000,
      }
    );

    if (response.data.features && response.data.features.length > 0) {
      const feature = response.data.features[0];
      res.json({
        success: true,
        data: {
          formatted: feature.properties.formatted,
          lat: feature.properties.lat,
          lon: feature.properties.lon,
          place_id: feature.properties.place_id,
          street: feature.properties.street,
          city: feature.properties.city,
          state: feature.properties.state,
          postcode: feature.properties.postcode,
        }
      });
      return;
    }

    res.status(404).json({ success: false, message: 'Location not found' });
  } catch (error) {
    console.error('Backend Reverse Geocode Error:', (error as any).message);
    handleError(error, res);
  }
};

export const searchLocations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.query;
    
    if (!text) {
      res.status(400).json({ success: false, message: 'text is required' });
      return;
    }

    const response = await axios.get(
      'https://api.geoapify.com/v1/geocode/autocomplete',
      {
        params: {
          text,
          filter: 'countrycode:in',
          limit: 5,
          apiKey: GEOAPIFY_API_KEY,
        },
        timeout: 5000,
      }
    );

    const results = response.data.features.map((feature: any) => ({
      formatted: feature.properties.formatted,
      lat: feature.properties.lat,
      lon: feature.properties.lon,
      place_id: feature.properties.place_id,
      street: feature.properties.street,
      city: feature.properties.city,
      state: feature.properties.state,
      postcode: feature.properties.postcode,
    }));

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Backend Search Location Error:', (error as any).message);
    handleError(error, res);
  }
};
