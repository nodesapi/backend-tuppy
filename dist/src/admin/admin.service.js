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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AdminService = class AdminService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async ensureAdmin(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.role !== 'ADMIN') {
            throw new common_1.ForbiddenException('Akses ditolak: Hanya Super Admin.');
        }
    }
    async getDashboardStats(userId) {
        await this.ensureAdmin(userId);
        const [totalUsers, totalPremium, totalOrders, totalTickets, revenueAggr] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.tenant.count({ where: { isPremium: true } }),
            this.prisma.order.count(),
            this.prisma.ticket.count({ where: { status: 'OPEN' } }),
            this.prisma.subscription.aggregate({
                _sum: { amount: true },
                where: { status: 'PAID' }
            })
        ]);
        const totalRevenue = revenueAggr._sum.amount || 0;
        return { totalUsers, totalPremium, totalOrders, openTickets: totalTickets, totalRevenue };
    }
    async getAllSubscriptions(userId) {
        await this.ensureAdmin(userId);
        return this.prisma.subscription.findMany({
            where: { status: 'PAID' },
            include: {
                tenant: {
                    include: {
                        user: { select: { email: true } }
                    }
                }
            },
            orderBy: { paidAt: 'desc' }
        });
    }
    async getAllTenants(userId) {
        await this.ensureAdmin(userId);
        return this.prisma.tenant.findMany({
            include: {
                user: { select: { email: true } },
                _count: { select: { orders: true, leads: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    async suspendTenant(userId, tenantId, isSuspended, reason) {
        await this.ensureAdmin(userId);
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant)
            throw new common_1.NotFoundException('Tenant tidak ditemukan');
        return this.prisma.tenant.update({
            where: { id: tenantId },
            data: {
                isSuspended,
                suspendReason: isSuspended ? reason : null
            }
        });
    }
    async getAllTickets(userId) {
        await this.ensureAdmin(userId);
        return this.prisma.ticket.findMany({
            orderBy: { createdAt: 'desc' }
        });
    }
    async updateTicketStatus(userId, ticketId, status) {
        await this.ensureAdmin(userId);
        return this.prisma.ticket.update({
            where: { id: ticketId },
            data: { status }
        });
    }
    async getGlobalConfig() {
        const configs = await this.prisma.systemConfig.findMany();
        const configMap = {};
        configs.forEach(c => configMap[c.key] = c.value);
        return configMap;
    }
    async updateGlobalConfig(userId, data) {
        await this.ensureAdmin(userId);
        const updates = Object.entries(data).map(([key, value]) => {
            return this.prisma.systemConfig.upsert({
                where: { key },
                update: { value: String(value) },
                create: { key, value: String(value) }
            });
        });
        await this.prisma.$transaction(updates);
        return { success: true, message: 'Configuration updated successfully' };
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminService);
//# sourceMappingURL=admin.service.js.map