import ImageKit from 'imagekit';

const isConfigured = !!(process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT);

export const imagekit = isConfigured 
  ? new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
    })
  : null;

/**
 * Uploads a file buffer to ImageKit and returns the URL
 */
export const uploadImage = async (file: Buffer, fileName: string, folder: string = '/velto'): Promise<string> => {
  try {
    if (!imagekit) {
      console.warn('ImageKit is not configured. Returning placeholder image.');
      return 'https://placehold.co/600x400?text=ImageKit+Not+Configured';
    }

    const response = await imagekit.upload({
      file: file.toString('base64'), // ImageKit Node SDK expects base64 or stream
      fileName: fileName,
      folder: folder,
    });
    return response.url;
  } catch (error) {
    console.error('ImageKit Upload Error:', error);
    throw new Error('Failed to upload image to cloud');
  }
};