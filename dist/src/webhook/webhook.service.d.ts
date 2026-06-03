import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
export declare class WebhookService {
    private readonly prisma;
    private readonly whatsappService;
    private readonly logger;
    constructor(prisma: PrismaService, whatsappService: WhatsappService);
    processPayhookWebhook(signature: string, rawPayload: string, body: any): Promise<{
        received: boolean;
        message: string;
    }>;
}
