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
exports.LeadsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let LeadsService = class LeadsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getMyLeads(userId, source, status) {
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant)
            return [];
        const where = { tenantId: tenant.id };
        if (source)
            where.source = source;
        if (status)
            where.status = status;
        return this.prisma.lead.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
    }
    async updateLeadStatus(leadId, dto, userId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant)
            throw new common_1.NotFoundException('Tenant tidak ditemukan.');
        const lead = await this.prisma.lead.findFirst({
            where: { id: leadId, tenantId: tenant.id },
        });
        if (!lead)
            throw new common_1.NotFoundException('Lead tidak ditemukan.');
        return this.prisma.lead.update({
            where: { id: leadId },
            data: {
                status: dto.status,
                ...(dto.internalNote !== undefined && { internalNote: dto.internalNote }),
            },
        });
    }
    async getInboxCount(userId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant)
            return { orders: 0, leads: 0, total: 0 };
        const [orders, leads] = await Promise.all([
            this.prisma.order.count({ where: { tenantId: tenant.id, status: 'PENDING' } }),
            this.prisma.lead.count({ where: { tenantId: tenant.id, status: 'NEW' } }),
        ]);
        return { orders, leads, total: orders + leads };
    }
};
exports.LeadsService = LeadsService;
exports.LeadsService = LeadsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LeadsService);
//# sourceMappingURL=leads.service.js.map