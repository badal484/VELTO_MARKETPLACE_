import ImageKit from 'imagekit';
import dotenv from 'dotenv';
import { AppError } from '../utils/errors';

dotenv.config();

/**
 * Service to handle image uploads to ImageKit.io
 * Provides a secure CDN-backed storage solution for the marketplace.
 */
class ImageKitService {
  private ik: ImageKit | null = null;

  constructor() {
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

    if (publicKey && privateKey && urlEndpoint) {
      this.ik = new ImageKit({
        publicKey,
        privateKey,
        urlEndpoint,
      });
      console.log('[SVC] ImageKit initialized successfully.');
    } else {
      console.warn('[SVC] ImageKit credentials missing. Uploads will FAIL.');
    }
  }

  async uploadImage(file: Express.Multer.File, folder: string = 'velto'): Promise<string> {
    if (!this.ik) {
      throw new AppError('Cloud storage not configured. Please contact administrator.', 500);
    }

    try {
      const response = await this.ik.upload({
        file: file.buffer, // required, buffer from multer
        fileName: `${Date.now()}-${file.originalname}`, // required
        folder: folder,
        useUniqueFileName: true,
      });

      return response.url;
    } catch (error: any) {
      console.error('[SVC] ImageKit Upload Error:', error);
      throw new AppError(`Upload failed: ${error.message}`, 500);
    }
  }

  async deleteImage(fileId: string): Promise<void> {
    if (!this.ik) return;
    try {
      await this.ik.deleteFile(fileId);
    } catch (error) {
      console.error('[SVC] ImageKit Delete Error:', error);
    }
  }
}

export const imageKitService = new ImageKitService();
