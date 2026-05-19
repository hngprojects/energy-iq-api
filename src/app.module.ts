import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import './config/env';
import { jwtConfig } from './config/jwt.config';
import { googleConfig } from './config/google.config';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { AppThrottlerGuard } from './common/guards/throttler.guard';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { chatbotConfig } from './config/chatbot.config';
import { EmailModule } from './modules/email/email.module';
import { redisConfig } from './config/redis.config';
import { BullModule } from '@nestjs/bullmq';
import { bullConfig } from './config/queue.config';
import { RedisModule } from './common/redis/redis.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { WellKnownModule } from './modules/well-known/well-known.module';
import { InvertersModule } from './modules/inverters/inverters.module';
import { InvertersMetricsModule } from './modules/inverters-metrics/inverters-metrics.module';
import { MetricsStreamModule } from './modules/metrics-stream/metrics-stream.module';
import { ContactModule } from './modules/contact/contact.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { whatsAppConfig } from './config/whatsapp.config';
import { WaitlistModule } from './modules/waitlist/waitlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        chatbotConfig,
        databaseConfig,
        jwtConfig,
        redisConfig,
        googleConfig,
        whatsAppConfig,
      ],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => databaseConfig(),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    BullModule.forRoot(bullConfig),
    HealthModule,
    UsersModule,
    AuthModule,
    EmailModule,
    RedisModule,
    WellKnownModule,
    InvertersModule,
    InvertersMetricsModule,
    MetricsStreamModule,
    ContactModule,
    ChatbotModule,
    AlertsModule,
    WhatsappModule,
    WaitlistModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
