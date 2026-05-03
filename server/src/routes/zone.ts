import express from 'express';
import * as zoneController from '../controllers/zoneController';
import { protect } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { Role } from '@shared/types';

const router = express.Router();

// Public route to check serviceability
router.get('/check', zoneController.checkServiceability);
router.get('/active', zoneController.getActiveZones);

// Admin only routes for zone management
router.get('/all', protect, requireAdmin, zoneController.getAllZones);
router.post('/', protect, requireAdmin, zoneController.createZone);
router.put('/:id', protect, requireAdmin, zoneController.updateZone);
router.delete('/:id', protect, requireAdmin, zoneController.deleteZone);

export default router;
