/**
 * Nama Aplikasi : tupp.ly
 * Fungsi File   : File konfigurasi / logika bisnis untuk app.controller.ts
 * Pembuat       : Wahyu Suhandi
 * GitHub        : https://github.com/nodesapi
 */

import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(@Res() res: Response) {
    const requestId = Math.random().toString(36).substring(2, 12).toUpperCase();
    const hostId = Math.random().toString(36).substring(2, 20) + '/' + Math.random().toString(36).substring(2, 20);
    
    const awsError = `<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>AccessDenied</Code>
  <Message>Access Denied</Message>
  <RequestId>${requestId}</RequestId>
  <HostId>${hostId}</HostId>
</Error>`;

    return res.status(403).type('application/xml').send(awsError);
  }
}
