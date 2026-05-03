import { Request, Response } from 'express';
import { ZoneService } from '../services/ZoneService';
import { handleError } from '../utils/errors';

export const getAllZones = async (req: Request, res: Response): Promise<void> => {
  try {
    const zones = await ZoneService.getAllZones();
    res.json({ success: true, data: zones });
  } catch (error) {
    console.error('CRITICAL ERROR in getAllZones:', error);
    handleError(error, res);
  }
};

export const getActiveZones = async (req: Request, res: Response): Promise<void> => {
  try {
    const zones = await ZoneService.getActiveZones();
    res.json({ success: true, data: zones });
  } catch (error) {
    handleError(error, res);
  }
};

export const createZone = async (req: Request, res: Response): Promise<void> => {
  try {
    const zone = await ZoneService.createZone(req.body);
    res.json({ success: true, data: zone, message: 'Zone created successfully' });
  } catch (error) {
    handleError(error, res);
  }
};

export const updateZone = async (req: Request, res: Response): Promise<void> => {
  try {
    const zone = await ZoneService.updateZone(req.params.id, req.body);
    res.json({ success: true, data: zone, message: 'Zone updated successfully' });
  } catch (error) {
    handleError(error, res);
  }
};

export const deleteZone = async (req: Request, res: Response): Promise<void> => {
  try {
    await ZoneService.deleteZone(req.params.id);
    res.json({ success: true, message: 'Zone deleted successfully' });
  } catch (error) {
    handleError(error, res);
  }
};

export const checkServiceability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { lng, lat } = req.query;
    if (!lng || !lat) {
      res.status(400).json({ success: false, message: 'Longitude and Latitude are required' });
      return;
    }
    const zone = await ZoneService.checkServiceability(Number(lng), Number(lat));
    res.json({ 
      success: true, 
      isServiceable: !!zone, 
      zoneName: zone ? zone.name : null 
    });
  } catch (error) {
    handleError(error, res);
  }
};
