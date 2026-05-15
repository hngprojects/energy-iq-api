import { BullRootModuleOptions } from '@nestjs/bullmq';
import { env } from './env';
import { redisConfig } from './redis.config';

const redisCfg = redisConfig();

export const bullConfig: BullRootModuleOptions = {
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    db: redisCfg.redisQueueDb,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: false,
  },
};
