import { registerAs } from '@nestjs/config';
import { env } from './env';

export const appConfig = registerAs('app', () => {
  /* 
      Make sure client url is among redirect origins
      We might be doing other redirects in the future,
      and client url has to be among allowed redirect origins
  */
  const clientUrl = env.CLIENT_URL;
  const normalizedClientOrigin = new URL(clientUrl).origin;
  const allowedRedirectOrigins = env.ALLOWED_REDIRECT_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    .map((o) => new URL(o).origin);

  if (!allowedRedirectOrigins.includes(normalizedClientOrigin)) {
    throw new Error(
      `Configuration error: CLIENT_URL (${clientUrl}) must be included in ALLOWED_REDIRECT_ORIGINS.`,
    );
  }
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    corsOrigin: env.CORS_ORIGIN,
    swaggerEnabled: env.SWAGGER_ENABLED,
    resendApiKey: env.RESEND_API_KEY,
    resendFrom: env.RESEND_FROM,
    supportEmail: env.SUPPORT_EMAIL,
    clientUrl,
    allowedRedirectOrigins,
    victronApiBaseUrl: env.VICTRON_API_BASE_URL,
    sandboxApiBaseUrl: env.SANDBOX_API_BASE_URL,
    growattApiBaseUrl: env.GROWATT_API_BASE_URL,
    sunsynkApiBaseUrl: env.SUNSYNK_API_BASE_URL,
    solarmanAppId: env.SOLARMAN_APP_ID,
    solarmanAppSecret: env.SOLARMAN_APP_SECRET,
    allowedSandboxTokens: env.ALLOWED_SANDBOX_TOKENS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    victronPollingRateSeconds: 120,
    growattPollingRateSeconds: 300,
    sunsynkPollingRateSeconds: 300,
    lowBatteryThreshold: env.METRIC_LOW_BATTERY_THRESHOLD,
    criticalBatteryThreshold: env.METRIC_CRITICAL_BATTERY_THRESHOLD,
    highBatteryTemperatureThreshold: env.METRIC_HIGH_BATTERY_TEMP_THRESHOLD,
  };
});
