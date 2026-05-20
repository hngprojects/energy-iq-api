import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Redis from 'ioredis';
import { EventEmitter } from 'events';

@Injectable()
export class MetricsPubSubService
  extends EventEmitter
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MetricsPubSubService.name);

  private publisher!: Redis.Redis;
  private subscriber!: Redis.Redis;

  private readonly subscriptions = new Map<
    string,
    Set<(message: string) => void>
  >();
  private readonly patternSubscriptions = new Map<
    string,
    Set<(message: string, channel: string) => void>
  >();

  constructor(private readonly configService: ConfigService) {
    super();
  }

  onModuleInit(): void {
    this.publisher = this.createClient('publisher');
    this.subscriber = this.createClient('subscriber');

    this.subscriber.on('message', (channel: string, message: string) => {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        callbacks.forEach((cb) => cb(message));
      }
    });

    this.subscriber.on(
      'pmessage',
      (pattern: string, channel: string, message: string) => {
        const callbacks = this.patternSubscriptions.get(pattern);
        if (callbacks) {
          callbacks.forEach((cb) => cb(message, channel));
        }
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
    this.logger.log('MetricsPubSubService: Redis clients closed');
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.publisher.publish(channel, message);
  }

  // Regular subscribe and unsubscribe

  async subscribe(
    channel: string,
    callback: (message: string) => void,
  ): Promise<void> {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }
    this.subscriptions.get(channel)!.add(callback);
  }

  async unsubscribe(
    channel: string,
    callback: (message: string) => void,
  ): Promise<void> {
    const callbacks = this.subscriptions.get(channel);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.subscriptions.delete(channel);
        await this.subscriber.unsubscribe(channel);
      }
    }
  }

  // Pattern subscribe and unsubscribe

  async psubscribe(
    pattern: string,
    callback: (message: string, channel: string) => void,
  ): Promise<void> {
    if (!this.patternSubscriptions.has(pattern)) {
      this.patternSubscriptions.set(pattern, new Set());
      await this.subscriber.psubscribe(pattern);
    }
    this.patternSubscriptions.get(pattern)!.add(callback);
  }

  async punsubscribe(
    pattern: string,
    callback: (message: string, channel: string) => void,
  ): Promise<void> {
    const callbacks = this.patternSubscriptions.get(pattern);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.patternSubscriptions.delete(pattern);
        await this.subscriber.punsubscribe(pattern);
      }
    }
  }

  private createClient(role: 'publisher' | 'subscriber'): Redis.Redis {
    const client = new Redis.Redis({
      host: this.configService.get<string>('redis.redisHost', 'localhost'),
      port: this.configService.get<number>('redis.redisPort', 6379),
      db: this.configService.get<number>('redis.redisDefaultDb', 0),
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    client.on('connect', () => {
      this.logger.log(`MetricsPubSubService: ${role} connected`);
    });

    client.on('error', (error: Error) => {
      this.logger.error(`MetricsPubSubService: ${role} error`, error.message);
      if (role === 'subscriber') {
        this.emit('error', error);
      }
    });

    return client;
  }
}
