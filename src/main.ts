import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Security headers
  app.use(helmet());

  // Cookie parser (for refresh token)
  app.use(cookieParser());

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS — support multiple origins for dev + production
  const frontendUrl = config.get('FRONTEND_URL', 'http://localhost:3001');
  const corsOrigins = frontendUrl.split(',').map((o: string) => o.trim());
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // Exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // WebSocket adapter (native ws)
  app.useWebSocketAdapter(new WsAdapter(app));

  const port = config.get('APP_PORT', 4000);
  await app.listen(port);
  console.log(`Backend running on port ${port}`);
}
bootstrap();
