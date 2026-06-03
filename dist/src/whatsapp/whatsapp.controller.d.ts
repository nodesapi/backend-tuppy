import { WhatsappService } from './whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class WhatsappController {
    private readonly whatsappService;
    private readonly prisma;
    constructor(whatsappService: WhatsappService, prisma: PrismaService);
    getStatus(req: any): Promise<{
        connected: boolean;
        qrCodeUrl: string | null;
        active: boolean;
    }>;
    logoutBot(req: any): Promise<{
        success: boolean;
        message: string;
    }>;
    getAdminStatus(req: any): Promise<{
        connected: boolean;
        qrCodeUrl: string | null;
        active: boolean;
        isEnabled: boolean;
    }>;
    toggleAdminStatus(req: any, enabled: boolean): Promise<{
        success: boolean;
        enabled: boolean;
    }>;
    getLogs(req: any): Promise<({
        tenant: {
            displayName: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        status: string;
        tenantId: string | null;
        message: string;
        orderId: string | null;
        phone: string;
        sentBy: string;
    })[]>;
}
