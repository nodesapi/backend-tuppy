export declare class PayhookService {
    private readonly logger;
    private readonly baseUrl;
    private readonly apiKey;
    createInvoice(payload: {
        amount: number;
        customer_name: string;
        customer_email?: string;
        external_id: string;
        description: string;
        channel_type?: string;
    }): Promise<any>;
}
