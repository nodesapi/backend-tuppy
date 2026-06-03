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
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const whatsapp_service_1 = require("../whatsapp/whatsapp.service");
const email_service_1 = require("../email/email.service");
let OrdersService = class OrdersService {
    prisma;
    whatsappService;
    emailService;
    constructor(prisma, whatsappService, emailService) {
        this.prisma = prisma;
        this.whatsappService = whatsappService;
        this.emailService = emailService;
    }
    async checkout(dto) {
        const { tenantUsername, customerName, customerPhone, customerEmail, shippingAddress, notes, channel, items } = dto;
        if (!items || items.length === 0) {
            throw new common_1.BadRequestException('Keranjang belanja kosong.');
        }
        const tenant = await this.prisma.tenant.findUnique({ where: { username: tenantUsername } });
        if (!tenant)
            throw new common_1.NotFoundException('Toko tidak ditemukan.');
        const grandTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const platformFee = 0;
        const netAmount = grandTotal - platformFee;
        const orderNumber = `TUPP-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 100)}`;
        const result = await this.prisma.$transaction(async (tx) => {
            const order = await tx.order.create({
                data: {
                    tenantId: tenant.id,
                    orderNumber,
                    customerName,
                    customerPhone,
                    customerEmail,
                    shippingAddress,
                    notes,
                    grandTotal,
                    platformFee,
                    netAmount,
                    channel: channel || 'DIRECT',
                    status: 'PENDING',
                },
            });
            await tx.orderItem.createMany({
                data: items.map((item) => ({
                    orderId: order.id,
                    blockId: item.blockId,
                    productName: item.productName,
                    imageUrl: item.imageUrl,
                    price: item.price,
                    quantity: item.quantity,
                    subtotal: item.price * item.quantity,
                })),
            });
            return order;
        });
        const fullOrder = await this.prisma.order.findUnique({
            where: { id: result.id },
            include: { items: true },
        });
        const waText = this.generateWaText(fullOrder, tenant.waPhoneNumber);
        const frontendDomain = process.env.FRONTEND_URL || 'http://localhost:3001';
        const trackingLink = `${frontendDomain}/track/${orderNumber}`;
        if (tenant.notifMethod === 'WHATSAPP' || tenant.notifMethod === 'BOTH') {
            const sellerMsg = `*[TUPPLY NOTIF]*\nAda pesanan baru masuk! 🎉\n\n*No. Order:* ${orderNumber}\n*Pembeli:* ${customerName}\n*Total:* Rp ${grandTotal.toLocaleString('id-ID')}\n\nSilakan cek dashboard Tupply Anda untuk detail lebih lanjut.`;
            if (tenant.waPhoneNumber) {
                this.whatsappService.sendMessage(tenant.id, tenant.waPhoneNumber, sellerMsg, result.id);
            }
            const buyerMsg = `Halo *${customerName}*, terima kasih telah berbelanja di *${tenant.displayName}*! 🛍️\n\nPesanan Anda dengan nomor *${orderNumber}* telah kami simpan.\n\nUntuk melacak status pengiriman (resi), klik:\n🌐 ${trackingLink}\n\nTerima kasih,\n${tenant.displayName}`;
            this.whatsappService.sendMessage(tenant.id, customerPhone, buyerMsg, result.id);
        }
        if (tenant.notifMethod === 'EMAIL' || tenant.notifMethod === 'BOTH') {
            if (customerEmail) {
                this.emailService.sendOrderReceipt(customerEmail, orderNumber, customerName, trackingLink, tenant.displayName);
            }
        }
        return {
            success: true,
            order: fullOrder,
            waLink: tenant.waPhoneNumber ? waText.link : null,
        };
    }
    async getMyOrders(userId, status) {
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant)
            return [];
        const where = { tenantId: tenant.id };
        if (status)
            where.status = status;
        return this.prisma.order.findMany({
            where,
            include: { items: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getOrderDetail(orderId, userId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant)
            throw new common_1.NotFoundException('Tenant tidak ditemukan.');
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, tenantId: tenant.id },
            include: { items: true },
        });
        if (!order)
            throw new common_1.NotFoundException('Order tidak ditemukan.');
        return order;
    }
    async updateOrderStatus(orderId, dto, userId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant)
            throw new common_1.NotFoundException('Tenant tidak ditemukan.');
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, tenantId: tenant.id },
        });
        if (!order)
            throw new common_1.NotFoundException('Order tidak ditemukan.');
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: dto.status,
                ...(dto.internalNote !== undefined && { internalNote: dto.internalNote }),
                ...(dto.courier !== undefined && { courier: dto.courier }),
                ...(dto.awbNumber !== undefined && { awbNumber: dto.awbNumber }),
            },
            include: { items: true },
        });
        if (dto.status === 'DELIVERED' && order.status !== 'DELIVERED') {
            await this.prisma.$transaction([
                this.prisma.tenant.update({
                    where: { id: tenant.id },
                    data: { walletBalance: { increment: order.netAmount } },
                }),
                this.prisma.walletTransaction.create({
                    data: {
                        tenantId: tenant.id,
                        type: 'CREDIT',
                        amount: order.netAmount,
                        description: `Penjualan selesai (${order.orderNumber})`,
                        referenceId: order.id,
                        status: 'SUCCESS',
                    },
                }),
            ]);
        }
        if ((dto.status === 'PROCESSING' || dto.status === 'DELIVERED') && dto.awbNumber && order.status !== dto.status) {
            const frontendDomain = process.env.FRONTEND_URL || 'http://localhost:3001';
            const trackingLink = `${frontendDomain}/track/${order.orderNumber}`;
            if (tenant.notifMethod === 'WHATSAPP' || tenant.notifMethod === 'BOTH') {
                const msg = `Halo *${order.customerName}*, pesanan Anda dengan nomor *${order.orderNumber}* sedang *${dto.status === 'DELIVERED' ? 'Dikirim/Selesai' : 'Diproses'}*.\n\nKurir: *${dto.courier || '-'}*\nResi: *${dto.awbNumber}*\n\nCek pesanan: ${trackingLink}`;
                this.whatsappService.sendMessage(tenant.id, order.customerPhone, msg, order.id);
            }
        }
        return updated;
    }
    generateWaText(order, tenantPhone) {
        const itemList = order.items
            .map((i) => `• ${i.productName} x${i.quantity} = Rp ${i.subtotal.toLocaleString('id-ID')}`)
            .join('\n');
        const text = `Halo! Saya baru saja melakukan pesanan di toko Anda 🛍️\n\n*No. Order:* ${order.orderNumber}\n*Nama:* ${order.customerName}\n*No. WA:* ${order.customerPhone}\n\n*Detail Pesanan:*\n${itemList}\n\n*Total: Rp ${order.grandTotal.toLocaleString('id-ID')}*\n\nMohon konfirmasi pesanan saya. Terima kasih!`;
        const encodedText = encodeURIComponent(text);
        const phone = tenantPhone?.replace(/\D/g, '').replace(/^0/, '62');
        const link = phone ? `https://wa.me/${phone}?text=${encodedText}` : null;
        return { text, link };
    }
    async getPendingCount(userId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
        if (!tenant)
            return { count: 0 };
        const count = await this.prisma.order.count({
            where: { tenantId: tenant.id, status: 'PENDING' },
        });
        return { count };
    }
    async trackOrder(orderNumber, phone) {
        if (!orderNumber || !phone)
            throw new common_1.BadRequestException('Nomor pesanan dan WhatsApp wajib diisi');
        const cleanedPhone = phone.replace(/\D/g, '');
        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
            include: { items: true, tenant: { select: { displayName: true } } },
        });
        if (!order)
            throw new common_1.NotFoundException('Pesanan tidak ditemukan');
        const orderPhoneCleaned = order.customerPhone.replace(/\D/g, '');
        if (orderPhoneCleaned !== cleanedPhone) {
            throw new common_1.BadRequestException('Nomor WhatsApp tidak cocok dengan pesanan ini');
        }
        return order;
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        whatsapp_service_1.WhatsappService,
        email_service_1.EmailService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map