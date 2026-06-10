import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import { PayhookService } from './payhook.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payhookService: PayhookService,
  ) {}

  async getPaymentChannels() {
    const channels = await this.payhookService.getChannels();
    return { success: true, data: channels };
  }

  async getCheckout(userId: string, invoiceId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId: tenant.id, invoiceUrl: invoiceId },
    });

    if (!subscription) throw new NotFoundException('Invoice not found');

    let paymentInstruction: any = subscription.paymentInstruction || {};

    // Auto-heal old invoices that don't have pay_amount saved OR actively check status if PENDING
    if (subscription.status !== 'PAID' && subscription.invoiceUrl) {
      const payhookInvoice = await this.payhookService.getInvoice(
        subscription.invoiceUrl,
      );

      if (payhookInvoice) {
        let needsUpdate = false;

        // Auto-heal pay_amount
        if (!paymentInstruction.pay_amount && payhookInvoice.pay_amount) {
          paymentInstruction.pay_amount = payhookInvoice.pay_amount;
          needsUpdate = true;
        }

        // Active Webhook Fallback: If Payhook says it's PAID, but we are still PENDING
        if (
          (payhookInvoice.status === 'paid' ||
            payhookInvoice.status === 'success') &&
          subscription.status !== 'PAID'
        ) {
          // Trigger the fulfillment logic just like a webhook would
          const updatedTenant = await this.prisma.$transaction(async (tx) => {
            await tx.subscription.update({
              where: { id: subscription.id },
              data: { status: 'PAID', paidAt: new Date(), paymentInstruction },
            });
            if (subscription.type === 'EVENT' && subscription.invitationId) {
              const inv = await tx.invitation.findUnique({
                where: { id: subscription.invitationId },
              });
              if (inv) {
                const currentExpiry =
                  inv.activeUntil && inv.activeUntil > new Date()
                    ? inv.activeUntil
                    : new Date();
                let additionalMonths = 3;
                if (subscription.plan === 'EVENT_6_MONTHS')
                  additionalMonths = 6;
                else if (subscription.plan === 'EVENT_12_MONTHS')
                  additionalMonths = 12;

                const newExpiry = new Date(currentExpiry);
                newExpiry.setMonth(newExpiry.getMonth() + additionalMonths);

                await tx.invitation.update({
                  where: { id: inv.id },
                  data: {
                    isPremium: true,
                    activeUntil: newExpiry,
                    premiumPackage: subscription.plan,
                    isActive: true,
                  },
                });
              }
              const t = await tx.tenant.findUnique({
                where: { id: subscription.tenantId },
                include: { user: true },
              });
              return t;
            } else if (subscription.type === 'TOPUP') {
              const updatedTenant = await tx.tenant.update({
                where: { id: subscription.tenantId },
                data: { walletBalance: { increment: subscription.amount } },
                include: { user: true },
              });
              await tx.walletTransaction.create({
                data: {
                  tenantId: subscription.tenantId,
                  type: 'CREDIT',
                  amount: subscription.amount,
                  description: `Top Up Saldo Tupply`,
                  referenceId: subscription.id,
                  status: 'SUCCESS',
                },
              });
              return updatedTenant;
            } else {
              const t = await tx.tenant.findUnique({
                where: { id: subscription.tenantId },
              });
              if (t) {
                const currentExpiry =
                  t.premiumUntil && t.premiumUntil > new Date()
                    ? t.premiumUntil
                    : new Date();
                const additionalMonths =
                  subscription.plan === 'YEARLY' ? 12 : 1;
                const newExpiry = new Date(currentExpiry);
                newExpiry.setMonth(newExpiry.getMonth() + additionalMonths);
                return tx.tenant.update({
                  where: { id: t.id },
                  data: { isPremium: true, premiumUntil: newExpiry },
                  include: { user: true },
                });
              }
              return null;
            }
          });

          // Trigger Payhook Provisioning if not already provisioned
          if (
            updatedTenant &&
            updatedTenant.user &&
            !updatedTenant.payhookTenantId
          ) {
            try {
              const payhookData =
                await this.payhookService.provisionPayhookAccount({
                  name: updatedTenant.displayName || updatedTenant.username,
                  email: updatedTenant.user.email,
                  phone: updatedTenant.waPhoneNumber || undefined,
                  password_hash: updatedTenant.user.password,
                  domain: updatedTenant.customDomain || undefined,
                });

              if (payhookData && payhookData.tenant_id) {
                await this.prisma.tenant.update({
                  where: { id: updatedTenant.id },
                  data: {
                    payhookTenantId: String(payhookData.tenant_id),
                    payhookApiKey: payhookData.api_key_production,
                  },
                });
              }
            } catch (err: any) {
              console.error(
                'Failed to provision Payhook account on getCheckout:',
                err.message,
              );
            }
          }

          // Return immediately with the updated status
          return {
            success: true,
            subscriptionId: subscription.id,
            invoiceId: subscription.invoiceUrl,
            pay_amount: paymentInstruction.pay_amount || subscription.amount,
            payment_instruction: paymentInstruction,
            amount: subscription.amount,
            status: 'PAID',
            plan: subscription.plan,
          };
        }

        // If it's not paid but we needed to update the paymentInstruction
        if (needsUpdate) {
          await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: { paymentInstruction },
          });
        }
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
      plan: subscription.plan,
    };
  }

  async createCheckout(
    userId: string,
    plan: string,
    channelId: number,
    type: 'COMMERCE' | 'EVENT' | 'TOPUP' = 'COMMERCE',
    invitationId?: string,
    topupAmount?: number,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    let amount = 0;
    let description = '';

    if (type === 'COMMERCE') {
      amount = plan === 'MONTHLY' ? 150000 : 1500000;
      description = `Upgrade to ${plan} Premium Plan for Tupply Store`;
    } else if (type === 'TOPUP') {
      if (!topupAmount || topupAmount < 10000)
        throw new BadRequestException('Minimal top up adalah Rp 10.000');
      amount = topupAmount;
      description = `Top Up Saldo Tupply`;
    } else {
      if (!invitationId) {
        throw new BadRequestException(
          'Invitation ID wajib dikirim untuk aktivasi undangan.',
        );
      }

      const invitation = await this.prisma.invitation.findFirst({
        where: {
          id: invitationId,
          tenantId: tenant.id,
        },
      });
      if (!invitation) {
        throw new NotFoundException('Undangan tidak ditemukan.');
      }

      // Dynamic Pricing from SystemConfig
      const configs = await this.prisma.systemConfig.findMany({
        where: {
          key: {
            in: ['EVENT_PRICING_3M', 'EVENT_PRICING_6M', 'EVENT_PRICING_12M'],
          },
        },
      });
      const pricing = {
        EVENT_3_MONTHS: 50000,
        EVENT_6_MONTHS: 100000,
        EVENT_12_MONTHS: 150000,
      };
      for (const c of configs) {
        if (c.key === 'EVENT_PRICING_3M')
          pricing['EVENT_3_MONTHS'] = parseInt(c.value);
        if (c.key === 'EVENT_PRICING_6M')
          pricing['EVENT_6_MONTHS'] = parseInt(c.value);
        if (c.key === 'EVENT_PRICING_12M')
          pricing['EVENT_12_MONTHS'] = parseInt(c.value);
      }

      if (plan === 'EVENT_3_MONTHS') amount = pricing['EVENT_3_MONTHS'];
      else if (plan === 'EVENT_6_MONTHS') amount = pricing['EVENT_6_MONTHS'];
      else if (plan === 'EVENT_12_MONTHS') amount = pricing['EVENT_12_MONTHS'];
      else throw new BadRequestException('Invalid EVENT plan');

      description = `Aktivasi undangan ${invitation.slug} (${plan.replace('EVENT_', '').replace('_', ' ')})`;
    }

    const referenceId = `TUPPLY-${Date.now()}`;

    // Buat tagihan pending di database
    const subscription = await this.prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        type,
        invitationId,
        plan,
        amount,
        status: 'PENDING',
        referenceId,
      },
    });

    // Generate real invoice using Payhook Service
    const invoice = await this.payhookService.createInvoice({
      amount,
      customer_name: tenant.displayName || tenant.username, // Use displayName or username
      external_id: referenceId,
      description,
      payment_channel_id: channelId,
    });

    // Update the subscription with the Payhook invoice number and payment instruction
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        invoiceUrl: invoice.invoice_number,
        paymentInstruction: {
          ...(typeof invoice.payment_instruction === 'object'
            ? invoice.payment_instruction
            : {}),
          pay_amount: invoice.pay_amount,
        } as any,
      },
    });

    return {
      success: true,
      subscriptionId: subscription.id,
      invoiceId: invoice.invoice_number,
      pay_amount: invoice.pay_amount,
      payment_instruction: invoice.payment_instruction,
      amount,
    };
  }

  // Webhook handler untuk menerima notifikasi pembayaran sukses dari Payhook
  async handleWebhook(payload: any) {
    // Payhook biasanya mengirim payload seperti { event: '...', invoice: { status: 'paid', invoice_number: 'INV...' } }
    // atau payload flat { status: 'paid', invoice_number: 'INV...' }
    const status =
      payload?.invoice?.status || payload.status || payload.transaction_status;
    const invoiceNumber =
      payload?.invoice?.invoice_number ||
      payload.invoice_number ||
      payload.payment_reference;

    // Kita hanya memproses yang lunas
    if (status !== 'paid' && status !== 'success')
      return { message: 'Ignored non-paid status' };

    const subscription = await this.prisma.subscription.findFirst({
      where: { invoiceUrl: invoiceNumber },
    });

    // JIKA BUKAN SUBSCRIPTION, CEK APAKAH INI PESANAN TOKO (ORDER)
    if (!subscription) {
      const order = await this.prisma.order.findFirst({
        where: { paymentLink: { contains: invoiceNumber } },
        include: { tenant: true },
      });

      if (!order)
        throw new NotFoundException('Subscription or Order not found');

      // Fulfillment untuk Pesanan Toko
      if (order.status === 'PENDING') {
        await this.prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'CONFIRMED',
              paymentMethod: payload.payment_channel || 'PAYHOOK',
            },
          });

          // Jika menggunakan Global Payhook, tambahkan saldo ke Wallet Penjual
          if (order.paymentGateway === 'PAYHOOK_GLOBAL') {
            await tx.tenant.update({
              where: { id: order.tenant.id },
              data: { walletBalance: { increment: order.netAmount } },
            });

            await tx.walletTransaction.create({
              data: {
                tenantId: order.tenant.id,
                type: 'CREDIT',
                amount: order.netAmount,
                description: `Penjualan dari Pesanan ${order.orderNumber} (Escrow)`,
                referenceId: order.id,
                status: 'SUCCESS',
              },
            });
          }
        });

        // Kirim WhatsApp (panggil dari luar tx jika perlu, di sini disederhanakan)
        // Kita tidak punya WhatsappService di sini, tapi status sudah sukses di DB
      }
      return { message: 'Processed as Order' };
    }

    if (subscription.status === 'PAID') return { message: 'Already paid' };

    // 3. Eksekusi Fulfillment dengan Transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Update status tagihan jadi lunas
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: 'PAID', paidAt: new Date() },
      });

      // Kalkulasi penambahan masa aktif premium
      const tenant = await tx.tenant.findUnique({
        where: { id: subscription.tenantId },
        include: { user: true },
      });
      if (!tenant) throw new Error('Tenant not found');

      if (subscription.type === 'EVENT' && subscription.invitationId) {
        const inv = await tx.invitation.findUnique({
          where: { id: subscription.invitationId },
        });
        if (inv) {
          const currentExpiry =
            inv.activeUntil && inv.activeUntil > new Date()
              ? inv.activeUntil
              : new Date();
          let additionalMonths = 3;
          if (subscription.plan === 'EVENT_6_MONTHS') additionalMonths = 6;
          else if (subscription.plan === 'EVENT_12_MONTHS')
            additionalMonths = 12;

          const newExpiry = new Date(currentExpiry);
          newExpiry.setMonth(newExpiry.getMonth() + additionalMonths);

          await tx.invitation.update({
            where: { id: inv.id },
            data: {
              isPremium: true,
              activeUntil: newExpiry,
              premiumPackage: subscription.plan,
              isActive: true,
            },
          });
        }
        return { success: true, message: 'Event Premium activated', tenant };
      } else if (subscription.type === 'TOPUP') {
        const updatedTenant = await tx.tenant.update({
          where: { id: subscription.tenantId },
          data: { walletBalance: { increment: subscription.amount } },
          include: { user: true },
        });
        await tx.walletTransaction.create({
          data: {
            tenantId: subscription.tenantId,
            type: 'CREDIT',
            amount: subscription.amount,
            description: `Top Up Saldo Tupply`,
            referenceId: subscription.id,
            status: 'SUCCESS',
          },
        });
        return {
          success: true,
          message: 'Top Up successful',
          tenant: updatedTenant,
        };
      } else {
        const currentExpiry =
          tenant.premiumUntil && tenant.premiumUntil > new Date()
            ? tenant.premiumUntil
            : new Date();

        const additionalMonths = subscription.plan === 'YEARLY' ? 12 : 1;
        const newExpiry = new Date(currentExpiry);
        newExpiry.setMonth(newExpiry.getMonth() + additionalMonths);

        // Aktifkan premium di Tenant
        const updatedTenant = await tx.tenant.update({
          where: { id: subscription.tenantId },
          data: {
            isPremium: true,
            premiumUntil: newExpiry,
          },
          include: { user: true },
        });

        return {
          success: true,
          message: 'Premium activated',
          tenant: updatedTenant,
        };
      }
    });

    // Jalankan integrasi eksternal setelah transaksi DB selesai dengan sukses
    try {
      if (
        result.tenant &&
        result.tenant.user &&
        !result.tenant.payhookTenantId
      ) {
        const payhookData = await this.payhookService.provisionPayhookAccount({
          name: result.tenant.displayName || result.tenant.username,
          email: result.tenant.user.email,
          phone: result.tenant.waPhoneNumber || undefined,
          password_hash: result.tenant.user.password, // Mengirim password_hash dari Tupply
          domain: result.tenant.customDomain || undefined,
        });

        if (payhookData && payhookData.tenant_id) {
          // Update tenant dengan data dari Payhook
          await this.prisma.tenant.update({
            where: { id: result.tenant.id },
            data: {
              payhookTenantId: String(payhookData.tenant_id),
              payhookApiKey: payhookData.api_key_production,
            },
          });
        }
      }
    } catch (err: any) {
      console.error(
        'Failed to provision Payhook account on webhook:',
        err.message,
      );
      // We don't throw here because Premium is already activated
    }

    return { success: true, message: result.message };
  }

  // Mengembalikan status premium saat ini (untuk UI Frontend)
  async getPremiumStatus(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const isPremiumActive =
      tenant.isPremium &&
      tenant.premiumUntil &&
      tenant.premiumUntil > new Date();

    // Jika kedaluwarsa, pastikan update ke false secara otomatis (opsional)
    if (tenant.isPremium && !isPremiumActive) {
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { isPremium: false },
      });
    }

    return {
      isPremium: isPremiumActive,
      premiumUntil: tenant.premiumUntil,
    };
  }

  async getHistory(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return this.prisma.subscription.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoiceDetail(userId: string, invoiceId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId: tenant.id,
        id: invoiceId,
      },
      include: {
        tenant: true,
      },
    });

    if (!subscription) throw new NotFoundException('Invoice not found');

    return subscription;
  }
}
