import { registerAs } from '@nestjs/config';
import { env } from './env';

export const googleConfig = registerAs('google', () => ({
  googleClientId: env.GOOGLE_CLIENT_ID,
  googleClientSecret: env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl: env.GOOGLE_CALLBACK_URL,
}));
