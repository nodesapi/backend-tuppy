import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import { PayhookService } from './payhook.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payhookService: PayhookService
  ) {}

  async getPaymentChannels() {
    const channels = await this.payhookService.getChannels();
    return { success: true, data: channels };
  }

  async getCheckout(userId: string, invoiceId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId: tenant.id, invoiceUrl: invoiceId }
    });

    if (!subscription) throw new NotFoundException('Invoice not found');

    let paymentInstruction: any = subscription.paymentInstruction || {};
    
    // Auto-heal old invoices that don't have pay_amount saved
    if (!paymentInstruction.pay_amount && subscription.invoiceUrl) {
      const payhookInvoice = await this.payhookService.getInvoice(subscription.invoiceUrl);
      if (payhookInvoice && payhookInvoice.pay_amount) {
        paymentInstruction.pay_amount = payhookInvoice.pay_amount;
        
        // Save it back to DB so we don't have to fetch again
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { paymentInstruction }
        });
      }
    }

    return {
      success: true,
      subscriptionId: subscription.id,
      invoiceId: subscription.invoiceUrl,
      pay_amount: paymentInstruction.pay_amount || subscription.amount,
      payment_instruction: paymentInstruction,
      amount: subscription.amount,
      status: subscription.status,
      plan: subscription.plan
    };
  }

  async createCheckout(userId: string, plan: 'MONTHLY' | 'YEARLY', channelId: number) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const amount = plan === 'MONTHLY' ? 150000 : 1500000;
    const referenceId = `TUPPLY-${Date.now()}`;

    // Buat tagihan pending di database
    const subscription = await this.prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        plan,
        amount,
        status: 'PENDING',
        referenceId
      }
    });

    // Generate real invoice using Payhook Service
    const invoice = await this.payhookService.createInvoice({
      amount,
      customer_name: tenant.displayName || tenant.username, // Use displayName or username
      external_id: referenceId,
      description: `Upgrade to ${plan} Premium Plan for Tupply`,
      payment_channel_id: channelId,
    });

    // Update the subscription with the Payhook invoice number and payment instruction
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { 
        invoiceUrl: invoice.invoice_number,
        paymentInstruction: {
          ...(typeof invoice.payment_instruction === 'object' ? invoice.payment_instruction : {}),
          pay_amount: invoice.pay_amount
        } as any
      } 
    });

    return {
      success: true,
      subscriptionId: subscription.id,
      invoiceId: invoice.invoice_number,
      pay_amount: invoice.pay_amount,
      payment_instruction: invoice.payment_instruction,
      amount
    };
  }

  // Webhook handler untuk menerima notifikasi pembayaran sukses dari Payhook
  async handleWebhook(payload: any) {
    // Payhook biasanya mengirim payload seperti { status: 'paid', invoice_number: 'INV...', external_id: '...' }
    const status = payload.status || payload.transaction_status;
    const invoiceNumber = payload.invoice_number || payload.payment_reference;

    // Kita hanya memproses yang lunas
    if (status !== 'paid' && status !== 'success') return { message: 'Ignored non-paid status' };

    const subscription = await this.prisma.subscription.findFirst({
      where: { invoiceUrl: invoiceNumber }
    });

    if (!subscription) throw new NotFoundException('Subscription not found');
    if (subscription.status === 'PAID') return { message: 'Already paid' };

    // 3. Eksekusi Fulfillment dengan Transaction
    return this.prisma.$transaction(async (tx) => {
      // Update status tagihan jadi lunas
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: 'PAID', paidAt: new Date() }
      });

      // Kalkulasi penambahan masa aktif premium
      const tenant = await tx.tenant.findUnique({ where: { id: subscription.tenantId } });
      if (!tenant) throw new Error('Tenant not found');

      const currentExpiry = tenant.premiumUntil && tenant.premiumUntil > new Date() 
        ? tenant.premiumUntil 
        : new Date();
      
      const additionalMonths = subscription.plan === 'YEARLY' ? 12 : 1;
      const newExpiry = new Date(currentExpiry);
      newExpiry.setMonth(newExpiry.getMonth() + additionalMonths);

      // Aktifkan premium di Tenant
      await tx.tenant.update({
        where: { id: subscription.tenantId },
        data: {
          isPremium: true,
          premiumUntil: newExpiry
        }
      });

      return { success: true, message: 'Premium activated' };
    });
  }

  // Mengembalikan status premium saat ini (untuk UI Frontend)
  async getPremiumStatus(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const isPremiumActive = tenant.isPremium && tenant.premiumUntil && tenant.premiumUntil > new Date();

    // Jika kedaluwarsa, pastikan update ke false secara otomatis (opsional)
    if (tenant.isPremium && !isPremiumActive) {
       await this.prisma.tenant.update({
         where: { id: tenant.id },
         data: { isPremium: false }
       });
    }

    return {
      isPremium: isPremiumActive,
      premiumUntil: tenant.premiumUntil
    };
  }

  async getHistory(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return this.prisma.subscription.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getInvoiceDetail(userId: string, invoiceId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId: tenant.id,
        id: invoiceId
      },
      include: {
        tenant: true
      }
    });

    if (!subscription) throw new NotFoundException('Invoice not found');

    return subscription;
  }
}
