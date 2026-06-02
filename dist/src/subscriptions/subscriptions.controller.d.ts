import { SubscriptionsService } from './subscriptions.service';
export declare class SubscriptionsController {
    private readonly subscriptionsService;
    constructor(subscriptionsService: SubscriptionsService);
    createCheckout(req: any, body: {
        plan: 'MONTHLY' | 'YEARLY';
    }): Promise<{
        success: boolean;
        subscriptionId: string;
        invoiceId: any;
        pay_amount: any;
        payment_instruction: any;
        amount: number;
    }>;
    getPremiumStatus(req: any): Promise<{
        isPremium: boolean | null;
        premiumUntil: Date | null;
    }>;
    handleWebhook(payload: any): Promise<{
        success: boolean;
        message: string;
    } | {
        message: string;
    }>;
}
