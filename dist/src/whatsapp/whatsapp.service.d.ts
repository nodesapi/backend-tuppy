import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
export declare class WhatsappService implements OnModuleInit, OnModuleDestroy {
    private prisma;
    private readonly logger;
    private sessions;
    private readonly baseAuthFolder;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): void;
    getSessionStatus(sessionId: string): {
        connected: boolean;
        qrCodeUrl: string | null;
        active: boolean;
    };
    stopBot(sessionId: string): Promise<void>;
    logoutBot(sessionId: string): Promise<void>;
    startBot(sessionId: string): Promise<void>;
    sendMessage(sessionId: string, phone: string, message: string, orderId?: string): Promise<boolean>;
}
