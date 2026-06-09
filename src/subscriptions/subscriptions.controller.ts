import { Controller, Post, Body, UseGuards, Request, Get, Param } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('channels')
  getPaymentChannels() {
    return this.subscriptionsService.getPaymentChannels();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('checkout/:invoiceId')
  getCheckout(@Request() req: any, @Param('invoiceId') invoiceId: string) {
    return this.subscriptionsService.getCheckout(req.user.id, invoiceId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('checkout')
  createCheckout(@Request() req: any, @Body() body: { plan: string, channelId: number, type?: 'COMMERCE' | 'EVENT' | 'TOPUP', invitationId?: string, topupAmount?: number }) {
    return this.subscriptionsService.createCheckout(req.user.id, body.plan, body.channelId, body.type || 'COMMERCE', body.invitationId, body.topupAmount);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('status')
  getPremiumStatus(@Request() req: any) {
    return this.subscriptionsService.getPremiumStatus(req.user.id);
  }

  // Webhook harus bisa diakses publik (tanpa JwtAuthGuard) oleh server Payment Gateway
  @Post('webhook')
  handleWebhook(@Body() payload: any) {
    return this.subscriptionsService.handleWebhook(payload);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('history')
  getHistory(@Request() req: any) {
    return this.subscriptionsService.getHistory(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('invoice/:id')
  getInvoiceDetail(@Request() req: any, @Param('id') invoiceId: string) {
    return this.subscriptionsService.getInvoiceDetail(req.user.id, invoiceId);
  }
}
