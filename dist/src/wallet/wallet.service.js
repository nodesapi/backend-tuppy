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
exports.WalletService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let WalletService = class WalletService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getMyWallet(userId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant)
            throw new common_1.NotFoundException('Tenant not found');
        const transactions = await this.prisma.walletTransaction.findMany({
            where: { tenantId: tenant.id },
            orderBy: { createdAt: 'desc' }
        });
        return {
            balance: tenant.walletBalance,
            transactions
        };
    }
    async withdraw(userId, amount) {
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant)
            throw new common_1.NotFoundException('Tenant not found');
        if (tenant.walletBalance < amount) {
            throw new common_1.BadRequestException('Saldo tidak mencukupi');
        }
        if (amount < 50000) {
            throw new common_1.BadRequestException('Minimal penarikan Rp 50.000');
        }
        const result = await this.prisma.$transaction(async (tx) => {
            await tx.tenant.update({
                where: { id: tenant.id },
                data: {
                    walletBalance: { decrement: amount }
                }
            });
            const trx = await tx.walletTransaction.create({
                data: {
                    tenantId: tenant.id,
                    type: 'DEBIT',
                    amount: amount,
                    description: 'Penarikan Dana (Withdraw)',
                    status: 'PENDING'
                }
            });
            return trx;
        });
        return { success: true, transaction: result };
    }
};
exports.WalletService = WalletService;
exports.WalletService = WalletService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WalletService);
//# sourceMappingURL=wallet.service.js.map