import { PrismaService } from '../prisma/prisma.service';
import { PayhookService } from './payhook.service';
export declare class SubscriptionsService {
    private readonly prisma;
    private readonly payhookService;
    constructor(prisma: PrismaService, payhookService: PayhookService);
    getPaymentChannels(): Promise<{
        success: boolean;
        data: any;
    }>;
    getCheckout(userId: string, invoiceId: string): Promise<{
        success: boolean;
        subscriptionId: string;
        invoiceId: string | null;
        pay_amount: any;
        payment_instruction: any;
        amount: number;
        status: string;
        plan: string;
    }>;
    createCheckout(userId: string, plan: 'MONTHLY' | 'YEARLY', channelId: number): Promise<{
        success: boolean;
        subscriptionId: string;
        invoiceId: any;
        pay_amount: any;
        payment_instruction: any;
        amount: number;
    }>;
    handleWebhook(payload: any): Promise<{
        message: string;
        success?: undefined;
    } | {
        success: boolean;
        message: string;
    }>;
    getPremiumStatus(userId: string): Promise<{
        isPremium: boolean | null;
        premiumUntil: Date | null;
    }>;
    getHistory(userId: string): Promise<{
        id: string;
        createdAt: Date;
        amount: number;
        status: string;
        tenantId: string;
        plan: string;
        invoiceUrl: string | null;
        referenceId: string | null;
        paymentInstruction: import("@prisma/client/runtime/client").JsonValue | null;
        paidAt: Date | null;
    }[]>;
    getInvoiceDetail(userId: string, invoiceId: string): Promise<{
        tenant: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            username: string;
            displayName: string;
            bio: string | null;
            avatarUrl: string | null;
            qrCodeUrl: string | null;
            customDomain: string | null;
            seoConfig: import("@prisma/client/runtime/client").JsonValue | null;
            isPremium: boolean;
            premiumUntil: Date | null;
            walletBalance: number;
            notifMethod: string;
            waPhoneNumber: string | null;
            pgProvider: string | null;
            pgApiKey: string | null;
            payhookTenantId: string | null;
            payhookApiKey: string | null;
            payhookWebhookSecret: string | null;
            payhookQrisUrl: string | null;
            bankName: string | null;
            bankAccount: string | null;
            bankAccountName: string | null;
            isSuspended: boolean;
            suspendReason: string | null;
            userId: string;
        };
    } & {
        id: string;
        createdAt: Date;
        amount: number;
        status: string;
        tenantId: string;
        plan: string;
        invoiceUrl: string | null;
        referenceId: string | null;
        paymentInstruction: import("@prisma/client/runtime/client").JsonValue | null;
        paidAt: Date | null;
    }>;
}
