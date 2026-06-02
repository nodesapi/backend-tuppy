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
let TenantService = class TenantService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
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
};
exports.TenantService = TenantService;
exports.TenantService = TenantService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TenantService);
//# sourceMappingURL=tenant.service.js.map