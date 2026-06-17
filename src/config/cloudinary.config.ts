import { registerAs } from '@nestjs/config';
import { env } from './env';

export const cloudinaryConfig = registerAs('cloudinary', () => ({
  apiKey: env.CLOUDINARY_API_KEY,
  apiSecret: env.CLOUDINARY_API_SECRET,
  cloudName: env.CLOUDINARY_CLOUD_NAME,
  resourceURL: env.CLOUDINARY_RESOURCE_URL,
}));
