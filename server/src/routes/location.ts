import { Router } from 'express';
import { reverseGeocode, searchLocations } from '../controllers/locationController';

const router = Router();

router.get('/reverse', reverseGeocode);
router.get('/search', searchLocations);

export default router;
