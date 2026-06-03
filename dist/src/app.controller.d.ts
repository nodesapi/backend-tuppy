import type { Response } from 'express';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
export declare class AppController {
    private readonly appService;
    private readonly prisma;
    constructor(appService: AppService, prisma: PrismaService);
    getPublicConfig(): Promise<Record<string, string>>;
    getHello(res: Response): Response<any, Record<string, any>>;
}
