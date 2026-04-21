import { Router } from 'express';
import { 
  createProduct, 
  getProducts, 
  getSingleProduct, 
  editProduct, 
  deleteProduct, 
  getMyProducts 
} from '../controllers/productController';
import { protect, optional } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.get('/', optional, getProducts);
router.get('/my', protect, getMyProducts);
router.get('/:id', optional, getSingleProduct);

router.post('/', protect, upload.array('images', 5), createProduct);
router.put('/:id', protect, upload.array('images', 5), editProduct);
router.delete('/:id', protect, deleteProduct);

export default router;
