import { INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { HealthModule } from '../src/modules/health/health.module';
import { WellKnownModule } from '../src/modules/well-known/well-known.module';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule, WellKnownModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({
      type: VersioningType.URI,
      prefix: 'v',
      defaultVersion: '1',
    });
    app.setGlobalPrefix('api', {
      exclude: ['.well-known/(.*)'],
    });
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  describe('Health', () => {
    it('GET /api/v1/health → 200', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          const body = res.body as {
            success: boolean;
            message: string;
            data: { status: string };
            meta: { timestamp: string };
          };

          expect(body.success).toBe(true);
          expect(body.message).toBe('Resource retrieved successfully');
          expect(body.data.status).toBe('ok');
          expect(body.meta.timestamp).toBeDefined();
        });
    });

    it('GET /health → 404 (because of global API prefix and versioning)', () => {
      return request(app.getHttpServer()).get('/health').expect(404);
    });
  });

  describe('Well Known (App Links)', () => {
    it('GET /.well-known/assetlinks.json → 200 (returns raw json array)', () => {
      return request(app.getHttpServer())
        .get('/.well-known/assetlinks.json')
        .expect(200)
        .expect('Content-Type', /application\/json/)
        .expect((res) => {
          const body = res.body as { target: { package_name: string } }[];
          expect(Array.isArray(body)).toBe(true);
          expect(body[0].target.package_name).toBe('com.hng14.energyiq');
        });
    });

    it('GET /api/.well-known/assetlinks.json → 404', () => {
      return request(app.getHttpServer())
        .get('/api/.well-known/assetlinks.json')
        .expect(404);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
