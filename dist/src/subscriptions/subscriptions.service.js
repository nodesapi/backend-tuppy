"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const payhook_service_1 = require("./payhook.service");
let SubscriptionsService = class SubscriptionsService {
    prisma;
    payhookService;
    constructor(prisma, payhookService) {
        this.prisma = prisma;
        this.payhookService = payhookService;
    }
    async getPaymentChannels() {
        const channels = await this.payhookService.getChannels();
        return { success: true, data: channels };
    }
    async getCheckout(userId, invoiceId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant)
            throw new common_1.NotFoundException('Tenant not found');
        const subscription = await this.prisma.subscription.findFirst({
            where: { tenantId: tenant.id, invoiceUrl: invoiceId }
        });
        if (!subscription)
            throw new common_1.NotFoundException('Invoice not found');
        let paymentInstruction = subscription.paymentInstruction || {};
        if (subscription.status !== 'PAID' && subscription.invoiceUrl) {
            const payhookInvoice = await this.payhookService.getInvoice(subscription.invoiceUrl);
            if (payhookInvoice) {
                let needsUpdate = false;
                if (!paymentInstruction.pay_amount && payhookInvoice.pay_amount) {
                    paymentInstruction.pay_amount = payhookInvoice.pay_amount;
                    needsUpdate = true;
                }
                if ((payhookInvoice.status === 'paid' || payhookInvoice.status === 'success') && subscription.status !== 'PAID') {
                    const updatedTenant = await this.prisma.$transaction(async (tx) => {
                        await tx.subscription.update({
                            where: { id: subscription.id },
                            data: { status: 'PAID', paidAt: new Date(), paymentInstruction }
                        });
                        const t = await tx.tenant.findUnique({ where: { id: subscription.tenantId } });
                        if (t) {
                            const currentExpiry = t.premiumUntil && t.premiumUntil > new Date() ? t.premiumUntil : new Date();
                            const additionalMonths = subscription.plan === 'YEARLY' ? 12 : 1;
                            const newExpiry = new Date(currentExpiry);
                            newExpiry.setMonth(newExpiry.getMonth() + additionalMonths);
                            return tx.tenant.update({
                                where: { id: t.id },
                                data: { isPremium: true, premiumUntil: newExpiry },
                                include: { user: true }
                            });
                        }
                        return null;
                    });
                    if (updatedTenant && updatedTenant.user && !updatedTenant.payhookTenantId) {
                        try {
                            const payhookData = await this.payhookService.provisionPayhookAccount({
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
                                        payhookApiKey: payhookData.api_key_production
                                    }
                                });
                            }
                        }
                        catch (err) {
                            console.error('Failed to provision Payhook account on getCheckout:', err.message);
                        }
                    }
                    return {
                        success: true,
                        subscriptionId: subscription.id,
                        invoiceId: subscription.invoiceUrl,
                        pay_amount: paymentInstruction.pay_amount || subscription.amount,
                        payment_instruction: paymentInstruction,
                        amount: subscription.amount,
                        status: 'PAID',
                        plan: subscription.plan
                    };
                }
                if (needsUpdate) {
                    await this.prisma.subscription.update({
                        where: { id: subscription.id },
                        data: { paymentInstruction }
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
            plan: subscription.plan
        };
    }
    async createCheckout(userId, plan, channelId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant)
            throw new common_1.NotFoundException('Tenant not found');
        const amount = plan === 'MONTHLY' ? 150000 : 1500000;
        const referenceId = `TUPPLY-${Date.now()}`;
        const subscription = await this.prisma.subscription.create({
            data: {
                tenantId: tenant.id,
                plan,
                amount,
                status: 'PENDING',
                referenceId
            }
        });
        const invoice = await this.payhookService.createInvoice({
            amount,
            customer_name: tenant.displayName || tenant.username,
            external_id: referenceId,
            description: `Upgrade to ${plan} Premium Plan for Tupply`,
            payment_channel_id: channelId,
        });
        await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                invoiceUrl: invoice.invoice_number,
                paymentInstruction: {
                    ...(typeof invoice.payment_instruction === 'object' ? invoice.payment_instruction : {}),
                    pay_amount: invoice.pay_amount
                }
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
    async handleWebhook(payload) {
        const status = payload.status || payload.transaction_status;
        const invoiceNumber = payload.invoice_number || payload.payment_reference;
        if (status !== 'paid' && status !== 'success')
            return { message: 'Ignored non-paid status' };
        const subscription = await this.prisma.subscription.findFirst({
            where: { invoiceUrl: invoiceNumber }
        });
        if (!subscription)
            throw new common_1.NotFoundException('Subscription not found');
        if (subscription.status === 'PAID')
            return { message: 'Already paid' };
        const result = await this.prisma.$transaction(async (tx) => {
            await tx.subscription.update({
                where: { id: subscription.id },
                data: { status: 'PAID', paidAt: new Date() }
            });
            const tenant = await tx.tenant.findUnique({ where: { id: subscription.tenantId } });
            if (!tenant)
                throw new Error('Tenant not found');
            const currentExpiry = tenant.premiumUntil && tenant.premiumUntil > new Date()
                ? tenant.premiumUntil
                : new Date();
            const additionalMonths = subscription.plan === 'YEARLY' ? 12 : 1;
            const newExpiry = new Date(currentExpiry);
            newExpiry.setMonth(newExpiry.getMonth() + additionalMonths);
            const updatedTenant = await tx.tenant.update({
                where: { id: subscription.tenantId },
                data: {
                    isPremium: true,
                    premiumUntil: newExpiry
                },
                include: { user: true }
            });
            return { success: true, message: 'Premium activated', tenant: updatedTenant };
        });
        try {
            if (result.tenant && result.tenant.user && !result.tenant.payhookTenantId) {
                const payhookData = await this.payhookService.provisionPayhookAccount({
                    name: result.tenant.displayName || result.tenant.username,
                    email: result.tenant.user.email,
                    phone: result.tenant.waPhoneNumber || undefined,
                    password_hash: result.tenant.user.password,
                    domain: result.tenant.customDomain || undefined,
                });
                if (payhookData && payhookData.tenant_id) {
                    await this.prisma.tenant.update({
                        where: { id: result.tenant.id },
                        data: {
                            payhookTenantId: String(payhookData.tenant_id),
                            payhookApiKey: payhookData.api_key_production
                        }
                    });
                }
            }
        }
        catch (err) {
            console.error('Failed to provision Payhook account on webhook:', err.message);
        }
        return { success: true, message: result.message };
    }
    async getPremiumStatus(userId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant)
            throw new common_1.NotFoundException('Tenant not found');
        const isPremiumActive = tenant.isPremium && tenant.premiumUntil && tenant.premiumUntil > new Date();
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
    async getHistory(userId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant)
            throw new common_1.NotFoundException('Tenant not found');
        return this.prisma.subscription.findMany({
            where: { tenantId: tenant.id },
            orderBy: { createdAt: 'desc' }
        });
    }
    async getInvoiceDetail(userId, invoiceId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant)
            throw new common_1.NotFoundException('Tenant not found');
        const subscription = await this.prisma.subscription.findFirst({
            where: {
                tenantId: tenant.id,
                id: invoiceId
            },
            include: {
                tenant: true
            }
        });
        if (!subscription)
            throw new common_1.NotFoundException('Invoice not found');
        return subscription;
    }
};
exports.SubscriptionsService = SubscriptionsService;
exports.SubscriptionsService = SubscriptionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        payhook_service_1.PayhookService])
], SubscriptionsService);
//# sourceMappingURL=subscriptions.service.js.map