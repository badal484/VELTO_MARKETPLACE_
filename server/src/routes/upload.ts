import { Router, Request, Response } from 'express';
import { protect } from '../middleware/auth';
import { upload, uploadAudio } from '../middleware/upload';
import { imageKitService } from '../services/imageKitService';
import { handleError, AppError } from '../utils/errors';

const router = Router();

/**
 * @route POST /api/upload/image
 * @desc  Upload a single image to ImageKit
 * @access Private
 */
router.post('/image', protect, upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      throw new AppError('No image file provided.', 400);
    }

    const folder = req.body.folder || 'misc';
    const imageUrl = await imageKitService.uploadImage(req.file, folder);

    res.status(200).json({
      success: true,
      url: imageUrl,
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * @route POST /api/upload/bulk
 * @desc  Upload multiple images
 * @access Private
 */
router.post('/bulk', protect, upload.array('images', 5), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new AppError('No images provided.', 400);
    }

    const folder = req.body.folder || 'products';
    const uploadPromises = files.map(file => imageKitService.uploadImage(file, folder));
    const urls = await Promise.all(uploadPromises);

    res.status(200).json({
      success: true,
      urls,
      message: `${files.length} images uploaded successfully`
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * @route POST /api/upload/audio
 * @desc  Upload a voice note to ImageKit
 * @access Private
 */
router.post('/audio', protect, uploadAudio.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) throw new AppError('No audio file provided.', 400);
    const audioUrl = await imageKitService.uploadImage(req.file, 'voice-notes');
    res.status(200).json({ success: true, url: audioUrl, message: 'Audio uploaded successfully' });
  } catch (error) {
    handleError(error, res);
  }
});

export default router;