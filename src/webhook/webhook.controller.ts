import {
  Controller,
  Post,
  Headers,
  Body,
  Req,
  UnauthorizedException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import type { Request } from 'express';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('payhook')
  @HttpCode(HttpStatus.OK)
  async handlePayhookWebhook(
    @Headers('X-Webhook-Signature') signature: string,
    @Body() body: any,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!signature) {
      throw new UnauthorizedException('Missing X-Webhook-Signature header');
    }

    // Since we need the raw payload to verify the HMAC signature,
    // NestJS needs to be configured to provide req.rawBody
    // Alternatively, we stringify the parsed body (less safe but works if keys are ordered)
    // Or we rely on a custom middleware.
    // For now, we will use JSON.stringify(body) or req.rawBody if available.

    const rawPayload = req.rawBody
      ? req.rawBody.toString()
      : JSON.stringify(body);

    return this.webhookService.processPayhookWebhook(
      signature,
      rawPayload,
      body,
    );
  }
}
