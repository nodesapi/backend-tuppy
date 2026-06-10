/**
 * Nama Aplikasi : tupp.ly
 * Fungsi File   : File konfigurasi / logika bisnis untuk main.ts
 * Pembuat       : Wahyu Suhandi
 * GitHub        : https://github.com/nodesapi
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { NotFoundExceptionFilter } from './filters/not-found.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Register Global Exception Filters
  app.useGlobalFilters(new NotFoundExceptionFilter());

  // Enable Cookie Parser
  app.use(cookieParser());

  // Protect Swagger UI with Custom Login
  app.use('/api/docs', (req: any, res: any, next: any) => {
    const session = req.cookies['tupply_docs_session'];
    if (
      session &&
      process.env.JWT_SECRET &&
      session === process.env.JWT_SECRET
    ) {
      next();
    } else {
      res.redirect('/docs/login');
    }
  });

  app.use('/api/docs-json', (req: any, res: any, next: any) => {
    const session = req.cookies['tupply_docs_session'];
    if (
      session &&
      process.env.JWT_SECRET &&
      session === process.env.JWT_SECRET
    ) {
      next();
    } else {
      res.status(401).send('Unauthorized');
    }
  });

  // Setup Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('tupp.ly Backend API')
    .setDescription(
      'Dokumentasi API untuk platform tupp.ly (Zero-Fee Creator & Commerce Hub)',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Enable CORS
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Swagger UI is available at: ${await app.getUrl()}/api/docs`);
}
bootstrap();
