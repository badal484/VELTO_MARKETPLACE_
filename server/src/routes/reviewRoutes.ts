import express from 'express';
import { createReview, getProductReviews } from '../controllers/reviewController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.post('/', protect, createReview);
router.get('/product/:productId', getProductReviews);

export default router;