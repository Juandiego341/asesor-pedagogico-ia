import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { runMigrations } from './db/migrate';
import { ensureBootstrap } from './seed';

async function bootstrap() {
  if (process.env.SKIP_MIGRATIONS !== 'true') await runMigrations();
  await ensureBootstrap();
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  app.use(cookieParser());
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  const origins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map((s) => s.trim());
  app.enableCors({ origin: origins, credentials: true });
  app.setGlobalPrefix('api');
  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`API escuchando en :${port}`);
}
bootstrap();
