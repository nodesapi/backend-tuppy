export declare class PayhookService {
    private readonly logger;
    private readonly baseUrl;
    private readonly apiKey;
    private readonly internalSecret;
    createInvoice(payload: {
        amount: number;
        customer_name: string;
        customer_email?: string;
        external_id: string;
        description: string;
        payment_channel_id?: number;
    }): Promise<any>;
    getInvoice(invoiceNumber: string): Promise<any>;
    getChannels(): Promise<any>;
    provisionPayhookAccount(payload: {
        name: string;
        email: string;
        phone?: string;
        password_hash: string;
        domain?: string;
        expired_at?: string;
        callback_url?: string;
    }): Promise<any>;
    uploadQris(tenantId: string | number, file: Express.Multer.File): Promise<any>;
}
