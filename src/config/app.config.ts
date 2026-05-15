import { registerAs } from '@nestjs/config';
import { env } from './env';

export const appConfig = registerAs('app', () => ({
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  corsOrigin: env.CORS_ORIGIN,
  swaggerEnabled: env.SWAGGER_ENABLED,
  resendApiKey: env.RESEND_API_KEY,
  resendFrom: env.RESEND_FROM,
  supportEmail: env.SUPPORT_EMAIL,
  clientUrl: env.CLIENT_URL,
  allowedRedirectOrigins: env.ALLOWED_REDIRECT_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  victronApiBaseUrl: env.VICTRON_API_BASE_URL,
  growattApiBaseUrl: env.GROWATT_API_BASE_URL,
  sunsynkApiBaseUrl: env.SUNSYNK_API_BASE_URL,
  solarmanAppId: env.SOLARMAN_APP_ID,
  solarmanAppSecret: env.SOLARMAN_APP_SECRET,
  victronPollingRateSeconds: 120,
  growattPollingRateSeconds: 300,
  sunsynkPollingRateSeconds: 300,
}));
