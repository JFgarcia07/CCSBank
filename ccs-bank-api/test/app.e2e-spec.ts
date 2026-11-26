import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  it('GET /health es público y responde ok', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ estado: 'ok', baseDeDatos: 'ok' });
  });

  it('GET /auth/me sin token responde 401', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('POST /auth/login con cuerpo vacío responde 400', () => {
    return request(app.getHttpServer()).post('/auth/login').send({}).expect(400);
  });

  it('POST /auth/login con credenciales falsas responde 401', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ usuario: 'no-existe', password: 'incorrecta' })
      .expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
