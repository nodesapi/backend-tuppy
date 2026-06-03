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
exports.TenantService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const dns_1 = require("dns");
const payhook_service_1 = require("../subscriptions/payhook.service");
let TenantService = class TenantService {
    prisma;
    payhookService;
    constructor(prisma, payhookService) {
        this.prisma = prisma;
        this.payhookService = payhookService;
    }
    async getTenantByUserId(userId) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { userId },
        });
        return tenant || null;
    }
    async updateTenant(userId, data) {
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (data.username) {
            const existingUser = await this.prisma.tenant.findUnique({ where: { username: data.username } });
            if (existingUser && existingUser.userId !== userId) {
                throw new common_1.BadRequestException('Username is already taken');
            }
        }
        if (data.notifMethod && (data.notifMethod === 'WHATSAPP' || data.notifMethod === 'BOTH')) {
            if (tenant && !tenant.isPremium) {
                throw new common_1.BadRequestException('Fitur WhatsApp Gateway khusus untuk pengguna Premium.');
            }
        }
        if (tenant) {
            return this.prisma.tenant.update({
                where: { userId },
                data,
            });
        }
        else {
            if (!data.username || !data.displayName) {
                throw new common_1.BadRequestException('Username and Display Name are required for a new store.');
            }
            return this.prisma.tenant.create({
                data: {
                    userId,
                    username: data.username,
                    displayName: data.displayName,
                    bio: data.bio || '',
                    avatarUrl: data.avatarUrl,
                    bankName: data.bankName,
                    bankAccount: data.bankAccount,
                    bankAccountName: data.bankAccountName,
                    waPhoneNumber: data.waPhoneNumber,
                    notifMethod: data.notifMethod || 'EMAIL',
                    pgProvider: data.pgProvider,
                },
            });
        }
    }
    async updateAvatar(userId, avatarUrl) {
        let tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant) {
            tenant = await this.prisma.tenant.create({
                data: {
                    userId,
                    username: `user_${userId.substring(0, 8)}`,
                    displayName: `Profil ${userId.substring(0, 4)}`,
                    avatarUrl,
                }
            });
            return tenant;
        }
        return this.prisma.tenant.update({
            where: { userId },
            data: { avatarUrl },
        });
    }
    async verifyDomain(userId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant || !tenant.customDomain) {
            throw new common_1.BadRequestException('Domain kustom belum dikonfigurasi. Silakan simpan pengaturan domain terlebih dahulu.');
        }
        try {
            await dns_1.promises.resolve(tenant.customDomain);
            return { verified: true, message: 'Domain berhasil diverifikasi dan terhubung dengan server.' };
        }
        catch (error) {
            return {
                verified: false,
                message: 'Domain belum terhubung. Pastikan pengaturan DNS sudah benar dan tunggu masa propagasi (5 menit hingga 24 jam).'
            };
        }
    }
    async uploadQrisToPayhook(userId, file) {
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant)
            throw new common_1.NotFoundException('Tenant not found');
        if (!tenant.isPremium)
            throw new common_1.BadRequestException('QRIS statis hanya untuk pengguna Premium.');
        if (!tenant.payhookTenantId)
            throw new common_1.BadRequestException('Akun Payhook belum diprovisioning. Harap hubungi admin.');
        const payhookData = await this.payhookService.uploadQris(tenant.payhookTenantId, file);
        if (payhookData && payhookData.qris_url) {
            await this.prisma.tenant.update({
                where: { id: tenant.id },
                data: { payhookQrisUrl: payhookData.qris_url }
            });
            return { success: true, qrisUrl: payhookData.qris_url };
        }
        throw new common_1.BadRequestException('Gagal mengunggah QRIS ke server Payhook.');
    }
    async provisionPaymentAccount(userId) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { userId },
            include: { user: true }
        });
        if (!tenant)
            throw new common_1.NotFoundException('Tenant not found');
        if (!tenant.isPremium)
            throw new common_1.BadRequestException('Hanya pengguna Premium yang dapat mengaktifkan fitur ini.');
        if (tenant.payhookTenantId)
            throw new common_1.BadRequestException('Akun Payhook sudah diaktifkan.');
        try {
            const payhookData = await this.payhookService.provisionPayhookAccount({
                name: tenant.displayName || tenant.username,
                email: tenant.user.email,
                phone: tenant.waPhoneNumber || undefined,
                password_hash: tenant.user.password,
                domain: tenant.customDomain || undefined,
                expired_at: tenant.premiumUntil ? tenant.premiumUntil.toISOString() : undefined,
                callback_url: process.env.PUBLIC_APP_URL
                    ? `${process.env.PUBLIC_APP_URL}/api/webhook/payhook`
                    : undefined,
            });
            if (payhookData && payhookData.tenant_id) {
                const updated = await this.prisma.tenant.update({
                    where: { id: tenant.id },
                    data: {
                        payhookTenantId: String(payhookData.tenant_id),
                        payhookApiKey: payhookData.api_key_production,
                        payhookWebhookSecret: payhookData.webhook_secret
                    }
                });
                return { success: true, message: 'Integrasi Payhook berhasil diaktifkan.', tenant: updated };
            }
            throw new Error('Data tidak lengkap dari Payhook');
        }
        catch (err) {
            console.error('Failed manual provisioning:', err.message);
            throw new common_1.BadRequestException('Gagal mengaktifkan integrasi Payhook. Pastikan server Payhook berjalan.');
        }
    }
};
exports.TenantService = TenantService;
exports.TenantService = TenantService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        payhook_service_1.PayhookService])
], TenantService);
//# sourceMappingURL=tenant.service.js.map