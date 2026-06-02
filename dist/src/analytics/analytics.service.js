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
exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AnalyticsService = class AnalyticsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async trackEvent(data) {
        return this.prisma.analyticsEvent.create({
            data: {
                tenantId: data.tenantId,
                type: data.type,
                targetId: data.targetId,
                userAgent: data.userAgent,
                ipHash: data.ipHash,
                referrer: data.referrer,
                country: data.country,
                city: data.city,
                device: data.device,
                os: data.os
            }
        });
    }
    async getSummary(userId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant) {
            return {
                isPremiumActive: false,
                overview: { totalViews: 0, totalClicks: 0, ctr: 0, totalSales: 0, walletBalance: 0 },
                chartData: [],
                topLinks: [],
                demographics: null
            };
        }
        const tenantId = tenant.id;
        const totalViews = await this.prisma.analyticsEvent.count({
            where: { tenantId, type: 'PAGE_VIEW' }
        });
        const totalClicks = await this.prisma.analyticsEvent.count({
            where: { tenantId, type: 'LINK_CLICK' }
        });
        const ctr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : 0;
        const totalSalesAggr = await this.prisma.order.aggregate({
            _sum: { grandTotal: true },
            where: { tenantId, status: 'DELIVERED' }
        });
        const totalSales = totalSalesAggr._sum.grandTotal || 0;
        const walletBalance = tenant.walletBalance || 0;
        const last7Days = [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            d.setHours(0, 0, 0, 0);
            return d;
        });
        const chartData = await Promise.all(last7Days.map(async (date) => {
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            const views = await this.prisma.analyticsEvent.count({
                where: {
                    tenantId,
                    type: 'PAGE_VIEW',
                    createdAt: { gte: date, lt: nextDate }
                }
            });
            const clicks = await this.prisma.analyticsEvent.count({
                where: {
                    tenantId,
                    type: 'LINK_CLICK',
                    createdAt: { gte: date, lt: nextDate }
                }
            });
            return {
                date: date.toISOString().split('T')[0],
                views,
                clicks
            };
        }));
        const clickEvents = await this.prisma.analyticsEvent.groupBy({
            by: ['targetId'],
            where: {
                tenantId,
                type: 'LINK_CLICK',
                targetId: { not: null }
            },
            _count: { targetId: true },
            orderBy: { _count: { targetId: 'desc' } },
            take: 5
        });
        const topLinks = await Promise.all(clickEvents.map(async (event) => {
            const block = await this.prisma.block.findUnique({ where: { id: event.targetId } });
            return {
                blockId: event.targetId,
                clicks: event._count.targetId,
                content: block?.content || null
            };
        }));
        const isPremiumActive = tenant.isPremium && tenant.premiumUntil && tenant.premiumUntil > new Date();
        let demographics = null;
        if (isPremiumActive) {
            const countryGroup = await this.prisma.analyticsEvent.groupBy({
                by: ['country'],
                where: { tenantId, country: { notIn: ['Unknown', ''] } },
                _count: { country: true },
                orderBy: { _count: { country: 'desc' } },
                take: 5
            });
            const deviceGroup = await this.prisma.analyticsEvent.groupBy({
                by: ['device'],
                where: { tenantId, device: { not: null } },
                _count: { device: true },
                orderBy: { _count: { device: 'desc' } }
            });
            const osGroup = await this.prisma.analyticsEvent.groupBy({
                by: ['os'],
                where: { tenantId, os: { not: null } },
                _count: { os: true },
                orderBy: { _count: { os: 'desc' } }
            });
            demographics = {
                countries: countryGroup.map(g => ({ name: g.country, count: g._count.country })),
                devices: deviceGroup.map(g => ({ name: g.device, count: g._count.device })),
                os: osGroup.map(g => ({ name: g.os, count: g._count.os }))
            };
        }
        return {
            isPremiumActive,
            overview: {
                totalViews,
                totalClicks,
                ctr: parseFloat(ctr),
                totalSales,
                walletBalance
            },
            chartData,
            topLinks,
            demographics
        };
    }
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AnalyticsService);
//# sourceMappingURL=analytics.service.js.map