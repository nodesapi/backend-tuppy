import type { RawBodyRequest } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import type { Request } from 'express';
export declare class WebhookController {
    private readonly webhookService;
    constructor(webhookService: WebhookService);
    handlePayhookWebhook(signature: string, body: any, req: RawBodyRequest<Request>): Promise<{
        received: boolean;
        message: string;
    }>;
}
