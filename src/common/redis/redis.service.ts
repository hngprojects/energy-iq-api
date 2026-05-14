import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
  Inject,
} from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import * as Redis from 'ioredis';
import { redisConfig } from '../../config/redis.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly clients = new Map<number, Redis.Redis>();

  constructor(
    @Inject(redisConfig.KEY)
    private readonly redisConfiguration: ConfigType<typeof redisConfig>,
  ) {}

  onModuleInit() {
    this.getClient(this.redisConfiguration.redisDefaultDb);
  }

  async onModuleDestroy() {
    const quits = Array.from(this.clients.values()).map((client) =>
      client.quit(),
    );
    await Promise.all(quits);
    this.logger.log('Redis clients closed');
  }

  getClient(db = this.redisConfiguration.redisDefaultDb): Redis.Redis {
    const existing = this.clients.get(db);
    if (existing) return existing;

    this.logger.log(`Connecting to Redis (DB ${db})...`);
    const client = new Redis.Redis({
      host: this.redisConfiguration.redisHost,
      port: this.redisConfiguration.redisPort,
      db,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });

    client.on('connect', () => {
      this.logger.log(`Redis client connected (DB ${db})`);
    });

    client.on('error', (error) => {
      this.logger.error(`Redis client error (DB ${db}):`, error);
    });

    this.clients.set(db, client);
    return client;
  }

  /**
   * get(key, unique)
   *
   * key: this is the unique key used to store a value in redis (email)
   * unique: this is a unique group that a key belong to (otp, verify)
   */
  async get(key: string, unique: string, db?: number): Promise<string | null> {
    const client = this.getClient(db);
    return await client.get(`${unique.toLowerCase()}:${key.toLowerCase()}`); //
  }

  /**
   * set(key, value, unique)
   *
   * key: this is the unique key used to store a value in redis (email)
   * value: this is the value being stored in redis (012345) e.g. the otp 6 digits
   * unique: this is a unique group that a key belong to (otp, verify)
   * ttl: this is the amount of time it takes before the value expires (it's calculated in seconds)
   */
  async set(
    key: string,
    value: string,
    unique: string,
    ttl?: number,
    db?: number,
  ): Promise<void> {
    const client = this.getClient(db);
    const effectiveTtl = ttl ?? this.redisConfiguration.redisDefaultTTL;
    if (!Number.isInteger(effectiveTtl) || effectiveTtl <= 0)
      throw new Error(`Invalid Redis TTL: ${effectiveTtl}`);

    await client.set(
      `${unique.toLowerCase()}:${key.toLowerCase()}`,
      value,
      'EX',
      effectiveTtl,
    );
  }

  /**
   * delete(key, unique)
   *
   * key: this is the unique key used to store a value in redis (email)
   * unique: this is a unique group that a key belong to (otp, verify)
   */
  async delete(key: string, unique: string, db?: number): Promise<void> {
    const client = this.getClient(db);
    await client.del(`${unique.toLowerCase()}:${key.toLowerCase()}`);
  }
}
