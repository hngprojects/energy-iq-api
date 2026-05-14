import { registerAs } from '@nestjs/config';
import { env } from './env';

export const redisConfig = registerAs('redis', () => ({
  redisHost: env.REDIS_HOST,
  redisPort: env.REDIS_PORT,
  redisDefaultDb: 0,
  redisOtpDb: 1,
  redisQueueDb: 2,
  redisCacheDb: 3,
  redisDefaultTTL: env.REDIS_DEFAULT_TTL,
}));
