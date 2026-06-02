import { PrismaService } from '../prisma/prisma.service';
import { PayhookService } from './payhook.service';
export declare class SubscriptionsService {
    private readonly prisma;
    private readonly payhookService;
    constructor(prisma: PrismaService, payhookService: PayhookService);
    createCheckout(userId: string, plan: 'MONTHLY' | 'YEARLY'): Promise<{
        success: boolean;
        subscriptionId: string;
        invoiceId: any;
        pay_amount: any;
        payment_instruction: any;
        amount: number;
    }>;
    handleWebhook(payload: any): Promise<{
        success: boolean;
        message: string;
    } | {
        message: string;
    }>;
    getPremiumStatus(userId: string): Promise<{
        isPremium: boolean | null;
        premiumUntil: Date | null;
    }>;
}
