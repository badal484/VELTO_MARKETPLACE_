import { Router } from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth';
import {
  searchCatalog,
  getCatalogItem,
  createPharmacyOrder,
  getActiveBroadcasts,
  acceptBroadcast,
  getMyPharmacyOrders,
  getPrescriptionUrl,
  adminListCatalog,
  adminAddCatalogItem,
  adminUpdateCatalogItem,
  adminToggleCatalogItem,
  adminDeleteCatalogItem,
  adminListPharmacyOrders,
} from '../controllers/pharmacyController';
import { Role } from '@shared/types';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

const router = Router();

// Multer: accept prescription images in memory (max 10 MB)
const prescriptionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are accepted for prescriptions'));
    }
    cb(null, true);
  },
});

// ── Role guards ───────────────────────────────────────────────────────────────

const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (req.user?.role !== Role.ADMIN) return next(new AppError('Admin access required', 403));
  next();
};

const requireSellerOrAdmin = (req: Request, _res: Response, next: NextFunction) => {
  const role = req.user?.role;
  if (role !== Role.SELLER && role !== Role.SHOP_OWNER && role !== Role.ADMIN) {
    return next(new AppError('Seller access required', 403));
  }
  next();
};

// ── All routes require authentication ─────────────────────────────────────────
router.use(protect);

// ── Catalog (public to all authenticated users) ──────────────────────────────
router.get('/catalog', searchCatalog);
router.get('/catalog/:id', getCatalogItem);

// ── Buyer: place pharmacy order ───────────────────────────────────────────────
// prescriptionUpload.single('prescription') — field name must be 'prescription'
router.post('/orders', prescriptionUpload.single('prescription'), createPharmacyOrder);

// ── Buyer: get prescription signed URL (also accessible to confirmed seller & admin) ──
router.get('/orders/:id/prescription', getPrescriptionUrl);

// ── Seller (pharmacy shop owner) ─────────────────────────────────────────────
router.get('/seller/broadcasts', requireSellerOrAdmin, getActiveBroadcasts);
router.post('/seller/orders/:id/accept', requireSellerOrAdmin, acceptBroadcast);
router.get('/seller/orders', requireSellerOrAdmin, getMyPharmacyOrders);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/admin/catalog', requireAdmin, adminListCatalog);
router.post('/admin/catalog', requireAdmin, adminAddCatalogItem);
router.put('/admin/catalog/:id', requireAdmin, adminUpdateCatalogItem);
router.patch('/admin/catalog/:id/toggle', requireAdmin, adminToggleCatalogItem);
router.delete('/admin/catalog/:id', requireAdmin, adminDeleteCatalogItem);
router.get('/admin/orders', requireAdmin, adminListPharmacyOrders);

export default router;
