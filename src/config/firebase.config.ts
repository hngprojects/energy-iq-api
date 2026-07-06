import { registerAs } from '@nestjs/config';
import { env } from './env';

export const firebaseConfig = registerAs('firebase', () => ({
  projectId: env.FIREBASE_PROJECT_ID,
  clientEmail: env.FIREBASE_CLIENT_EMAIL,
  privateKey: env.FIREBASE_PRIVATE_KEY,
}));
