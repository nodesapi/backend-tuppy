import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class DocsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Mengecek apakah cookie session valid
    const session = req.cookies['tupply_docs_session'];

    if (session === process.env.JWT_SECRET) {
      // Jika valid, izinkan masuk ke halaman Swagger API
      next();
    } else {
      // Jika tidak ada akses, tendang ke halaman login custom
      res.redirect('/docs/login');
    }
  }
}
