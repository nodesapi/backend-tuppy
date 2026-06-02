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
exports.PagesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PagesService = class PagesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getMyPage(userId, slug) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { userId }
        });
        if (!tenant) {
            return {
                id: 'dummy',
                tenantId: 'dummy',
                slug,
                title: 'Dummy Page (Admin)',
                themeConfig: {},
                blocks: []
            };
        }
        let page = await this.prisma.page.findFirst({
            where: { tenantId: tenant.id, slug },
            include: { blocks: { orderBy: { order: 'asc' } } }
        });
        if (!page) {
            page = await this.prisma.page.create({
                data: {
                    tenantId: tenant.id,
                    slug,
                    title: slug === 'index' ? 'Halaman Utama' : slug,
                    themeConfig: {},
                },
                include: { blocks: { orderBy: { order: 'asc' } } }
            });
        }
        return page;
    }
    async getPublicPage(slug) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { username: slug }
        });
        if (!tenant)
            throw new common_1.NotFoundException('Store not found');
        if (tenant.isSuspended) {
            return {
                suspended: true,
                reason: tenant.suspendReason || 'Melanggar Ketentuan Layanan'
            };
        }
        const page = await this.prisma.page.findFirst({
            where: { tenantId: tenant.id, slug: 'index' },
            include: {
                blocks: { orderBy: { order: 'asc' } },
                tenant: true
            }
        });
        if (!page)
            throw new common_1.NotFoundException('Page not found');
        return page;
    }
    async updateMyPage(userId, slug, data) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { userId }
        });
        if (!tenant) {
            return {
                id: 'dummy',
                tenantId: 'dummy',
                slug,
                title: 'Dummy Page (Admin)',
                themeConfig: data.themeConfig || {},
                blocks: data.blocks || []
            };
        }
        let page = await this.prisma.page.findFirst({
            where: { tenantId: tenant.id, slug }
        });
        if (!page) {
            page = await this.prisma.page.create({
                data: {
                    tenantId: tenant.id,
                    slug,
                    title: slug === 'index' ? 'Halaman Utama' : slug,
                    themeConfig: {},
                }
            });
        }
        return this.prisma.$transaction(async (tx) => {
            const updatedPage = await tx.page.update({
                where: { id: page.id },
                data: {
                    themeConfig: data.themeConfig !== undefined ? data.themeConfig : undefined
                }
            });
            if (data.blocks && Array.isArray(data.blocks)) {
                await tx.block.deleteMany({
                    where: { pageId: page.id }
                });
                const blocksData = data.blocks.map((b, index) => ({
                    pageId: page.id,
                    type: b.type,
                    order: index,
                    content: b.content || {}
                }));
                if (blocksData.length > 0) {
                    await tx.block.createMany({
                        data: blocksData
                    });
                }
            }
            return tx.page.findUnique({
                where: { id: page.id },
                include: { blocks: { orderBy: { order: 'asc' } } }
            });
        });
    }
};
exports.PagesService = PagesService;
exports.PagesService = PagesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PagesService);
//# sourceMappingURL=pages.service.js.map