import { createEnv } from '@t3-oss/env-core';
import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(['development', 'staging', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    HOST: z.string().default('localhost'),
    CLIENT_URL: z.url().default('http://localhost:3000'),
    ALLOWED_REDIRECT_ORIGINS: z.string().default('http://localhost:3000,'), // add origins and separate with comma

    DATABASE_HOST: z.string().min(1),
    DATABASE_PORT: z.coerce.number().int().positive().default(5432),
    DATABASE_USER: z.string().min(1),
    DATABASE_PASSWORD: z.string(),
    DATABASE_NAME: z.string().min(1),
    DATABASE_SYNC: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .default(false)
      .transform((v) => v === true || v === 'true'),
    DATABASE_LOGGING: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .default(false)
      .transform((v) => v === true || v === 'true'),
    DATABASE_SSL: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .default(false)
      .transform((v) => v === true || v === 'true'),

    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    REDIS_DEFAULT_TTL: z.coerce.number().int().positive().default(900),

    RESEND_API_KEY: z.string().min(1),
    RESEND_FROM: z.email().default('energyiq@hng14.com'),
    SUPPORT_EMAIL: z.email().default('energyiq@hng14.com'),

    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GOOGLE_CALLBACK_URL: z.url(),

    CORS_ORIGIN: z.string().default('*'),
    SWAGGER_ENABLED: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .default(true)
      .transform((v) => v === true || v === 'true'),

    // BetterStack / Logtail
    LOGTAIL_SOURCE_TOKEN: z.string().optional().default(''),
    LOGTAIL_INGESTING_ENDPOINT: z
      .url()
      .optional()
      .default('https://in.logtail.com'),

    CHAT_CONTEXT_LENGTH: z.coerce
      .number()
      .int()
      .positive()
      .transform((v) => Number(v)),
    CHAT_EXP_TIMEOUT_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .transform((v) => Number(v)),
    GROQ_API_KEY: z.string().nonoptional(),
    GEMINI_API_KEY: z.string().nonoptional(),
    CHATBOT_NAME: z.string().default('orochimaru'),
    SECRET_MANAGER_ENCRYPTION_KEY: z.string().length(32),

    VICTRON_API_BASE_URL: z
      .url()
      .default('https://vrmapi.victronenergy.com/v2'),
    GROWATT_API_BASE_URL: z.url().default('https://openapi.growatt.com'),
    SUNSYNK_API_BASE_URL: z.url().default('https://globalapi.solarmanpv.com'),
    SANDBOX_API_BASE_URL: z.url().default('http://localhost:3002'),
    SOLARMAN_APP_ID: z.string().min(1),
    SOLARMAN_APP_SECRET: z.string().min(1),
    ALLOWED_SANDBOX_TOKENS: z
      .string()
      .default('mock-token-a,mock-token-b,mock-token-c'),

    TWILIO_ACCOUNT_SID: z.string().min(1),
    TWILIO_AUTH_TOKEN: z.string().min(1),
    TWILIO_WHATSAPP_FROM: z.string().min(1),

    METRIC_LOW_BATTERY_THRESHOLD: z.coerce
      .number()
      .int()
      .positive()
      .transform((v) => Number(v)),
    METRIC_CRITICAL_BATTERY_THRESHOLD: z.coerce
      .number()
      .int()
      .positive()
      .transform((v) => Number(v)),
    METRIC_HIGH_BATTERY_TEMP_THRESHOLD: z.coerce
      .number()
      .int()
      .positive()
      .transform((v) => Number(v)),

    CLOUDINARY_CLOUD_NAME: z.string().nonoptional(),
    CLOUDINARY_API_KEY: z.string().nonoptional(),
    CLOUDINARY_API_SECRET: z.string().nonoptional(),
    CLOUDINARY_RESOURCE_URL: z.url().default('https://res.cloudinary.com'),

    // # Firebase Admin SDK
    FIREBASE_PROJECT_ID: z.string().nonoptional(),
    FIREBASE_CLIENT_EMAIL: z.email(),
    FIREBASE_PRIVATE_KEY: z
      .string()
      .min(50, 'Key too short')
      .refine(
        (val) =>
          val.includes('-----BEGIN RSA PRIVATE KEY-----') ||
          val.includes('-----BEGIN PRIVATE KEY-----'),
        { message: 'Invalid RSA private key format. Must be PEM' },
      )
      .refine(
        (val) =>
          val.includes('-----END RSA PRIVATE KEY-----') ||
          val.includes('-----END PRIVATE KEY-----'),
        { message: 'Invalid RSA private key format. Missing END header' },
      ),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export type Env = typeof env;
