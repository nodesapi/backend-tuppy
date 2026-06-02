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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const whatsapp_service_1 = require("./whatsapp.service");
const prisma_service_1 = require("../prisma/prisma.service");
let WhatsappController = class WhatsappController {
    whatsappService;
    prisma;
    constructor(whatsappService, prisma) {
        this.whatsappService = whatsappService;
        this.prisma = prisma;
    }
    async getStatus(req) {
        const userId = req.user.id;
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant)
            throw new common_1.ForbiddenException('Tenant not found');
        if (tenant.notifMethod === 'WHATSAPP' || tenant.notifMethod === 'BOTH') {
            this.whatsappService.startBot(tenant.id);
        }
        return this.whatsappService.getSessionStatus(tenant.id);
    }
    async logoutBot(req) {
        const userId = req.user.id;
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant)
            throw new common_1.ForbiddenException('Tenant not found');
        await this.whatsappService.logoutBot(tenant.id);
        return { success: true, message: 'WhatsApp disconnected' };
    }
    async getAdminStatus(req) {
        if (req.user.role !== 'ADMIN')
            throw new common_1.ForbiddenException('Admin only');
        const config = await this.prisma.systemConfig.findUnique({ where: { key: 'WHATSAPP_SYSTEM_ENABLED' } });
        const isEnabled = config?.value === 'true';
        const sessionStatus = this.whatsappService.getSessionStatus('SYSTEM');
        return {
            isEnabled,
            ...sessionStatus
        };
    }
    async toggleAdminStatus(req, enabled) {
        if (req.user.role !== 'ADMIN')
            throw new common_1.ForbiddenException('Admin only');
        await this.prisma.systemConfig.upsert({
            where: { key: 'WHATSAPP_SYSTEM_ENABLED' },
            update: { value: enabled ? 'true' : 'false' },
            create: { key: 'WHATSAPP_SYSTEM_ENABLED', value: enabled ? 'true' : 'false' }
        });
        if (enabled) {
            await this.whatsappService.startBot('SYSTEM');
        }
        else {
            await this.whatsappService.stopBot('SYSTEM');
        }
        return { success: true, enabled };
    }
    async getLogs(req) {
        if (req.user.role !== 'ADMIN')
            throw new common_1.ForbiddenException('Admin only');
        const logs = await this.prisma.whatsappLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 200,
            include: {
                tenant: {
                    select: { displayName: true }
                }
            }
        });
        return logs;
    }
};
exports.WhatsappController = WhatsappController;
__decorate([
    (0, common_1.Get)('status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WhatsappController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Post)('logout'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WhatsappController.prototype, "logoutBot", null);
__decorate([
    (0, common_1.Get)('admin/status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WhatsappController.prototype, "getAdminStatus", null);
__decorate([
    (0, common_1.Post)('admin/toggle'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('enabled')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Boolean]),
    __metadata("design:returntype", Promise)
], WhatsappController.prototype, "toggleAdminStatus", null);
__decorate([
    (0, common_1.Get)('admin/logs'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WhatsappController.prototype, "getLogs", null);
exports.WhatsappController = WhatsappController = __decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Controller)('whatsapp'),
    __metadata("design:paramtypes", [whatsapp_service_1.WhatsappService,
        prisma_service_1.PrismaService])
], WhatsappController);
//# sourceMappingURL=whatsapp.controller.js.map