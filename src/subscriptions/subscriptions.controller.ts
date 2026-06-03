import { Controller, Post, Body, UseGuards, Request, Get, Param } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('checkout')
  createCheckout(@Request() req: any, @Body() body: { plan: 'MONTHLY' | 'YEARLY' }) {
    return this.subscriptionsService.createCheckout(req.user.id, body.plan);
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
