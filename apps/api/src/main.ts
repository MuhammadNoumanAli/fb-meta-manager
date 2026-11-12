import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApplication } from './app.setup';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const prefix = config.get<string>('apiPrefix') ?? 'api/v1';

  configureApplication(app, prefix);
  app.enableCors({
    origin: config.get<string>('frontendOrigin'),
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AdPilot API')
    .setDescription(
      'Multi-tenant advertising management API. Phase 1 covers authentication and tenancy.',
    )
    .setVersion('0.2.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start AdPilot API', error);
  process.exit(1);
});
