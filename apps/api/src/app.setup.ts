import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/**
 * Shared HTTP configuration for the real server and end-to-end tests so that
 * routing, cookies and validation behave identically in both environments.
 */
export const configureApplication = (
  app: INestApplication,
  prefix = 'api/v1',
): INestApplication => {
  app.setGlobalPrefix(prefix);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  return app;
};
