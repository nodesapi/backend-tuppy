import { Injectable, Logger, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import * as crypto from 'crypto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService
  ) {}

  async processPayhookWebhook(signature: string, rawPayload: string, body: any) {
    this.logger.log(`Received Payhook Webhook: ${JSON.stringify(body)}`);

    if (body.event !== 'payment.status.updated' || !body.invoice) {
      return { received: true, message: 'Ignored non-payment event' };
    }

    const invoiceNumber = body.invoice.invoice_number;
    const status = body.invoice.status;

    if (status !== 'paid' && status !== 'success') {
      return { received: true, message: 'Ignored non-paid status' };
    }

    // 1. Find the Order (Payhook invoice_number is stored inside paymentLink JSON)
    const order = await this.prisma.order.findFirst({
      where: {
        paymentLink: {
          contains: invoiceNumber
        }
      },
      include: { tenant: true }
    });

    if (!order) {
      this.logger.warn(`Order not found for invoice_number: ${invoiceNumber}`);
      throw new NotFoundException('Order not found');
    }

    const tenant = order.tenant;

    let secretToUse = tenant.payhookWebhookSecret;
    if (order.paymentGateway === 'PAYHOOK_GLOBAL') {
      secretToUse = process.env.PAYHOOK_WEBHOOK_SECRET || process.env.TUPPLY_INTERNAL_SECRET || 'tupply-dev-secret-key-12345';
    }

    if (!secretToUse) {
      this.logger.error(`Webhook secret is missing for order ${invoiceNumber}`);
      throw new UnauthorizedException('Webhook secret configuration missing');
    }

    // 2. Verify HMAC Signature
    const expectedSignature = crypto
      .createHmac('sha256', secretToUse)
      .update(rawPayload)
      .digest('hex');

    if (signature !== expectedSignature) {
      this.logger.error(`Invalid webhook signature for order ${invoiceNumber}`);
      throw new UnauthorizedException('Invalid signature');
    }

    // 3. Update Order Status
    if (order.status === 'PENDING') {
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'CONFIRMED',
            paymentMethod: body.invoice?.payment_channel || 'PAYHOOK',
          }
        });

        // Jika menggunakan Global Payhook, tambahkan saldo ke Wallet Penjual (Net Amount utuh, kode unik masuk ke Global)
        if (order.paymentGateway === 'PAYHOOK_GLOBAL') {
          await tx.tenant.update({
            where: { id: tenant.id },
            data: { walletBalance: { increment: order.netAmount } }
          });

          await tx.walletTransaction.create({
            data: {
              tenantId: tenant.id,
              type: 'CREDIT',
              amount: order.netAmount,
              description: `Penjualan dari Pesanan ${order.orderNumber} (Escrow)`,
              referenceId: order.id,
              status: 'SUCCESS'
            }
          });
        }
      });

      this.logger.log(`Order ${invoiceNumber} marked as CONFIRMED`);

      // 4. Send WhatsApp Notification
      if (tenant.notifMethod === 'WHATSAPP' || tenant.notifMethod === 'BOTH') {
        const msg = `*[TUPPLY PAYMENT]*\nPembayaran untuk pesanan *${order.orderNumber}* telah BERHASIL diterima sejumlah Rp ${order.grandTotal.toLocaleString('id-ID')}.\n\nSilakan proses pesanan ini.`;
        if (tenant.waPhoneNumber) {
          this.whatsappService.sendMessage(tenant.id, tenant.waPhoneNumber, msg, order.id);
        }
      }
    } else {
      this.logger.log(`Order ${invoiceNumber} is already ${order.status}`);
    }

    return { received: true, message: 'Payment processed successfully' };
  }
}
