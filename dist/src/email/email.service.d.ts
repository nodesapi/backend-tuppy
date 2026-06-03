export declare class EmailService {
    private readonly logger;
    private transporter;
    constructor();
    sendOrderReceipt(toEmail: string, orderNumber: string, customerName: string, trackingLink: string, tenantName: string): Promise<boolean>;
}
