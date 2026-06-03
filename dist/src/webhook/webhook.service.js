"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WebhookService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const whatsapp_service_1 = require("../whatsapp/whatsapp.service");
const crypto = __importStar(require("crypto"));
let WebhookService = WebhookService_1 = class WebhookService {
    prisma;
    whatsappService;
    logger = new common_1.Logger(WebhookService_1.name);
    constructor(prisma, whatsappService) {
        this.prisma = prisma;
        this.whatsappService = whatsappService;
    }
    async processPayhookWebhook(signature, rawPayload, body) {
        this.logger.log(`Received Payhook Webhook: ${JSON.stringify(body)}`);
        if (body.event !== 'payment.status.updated' || !body.invoice) {
            return { received: true, message: 'Ignored non-payment event' };
        }
        const invoiceNumber = body.invoice.invoice_number;
        const status = body.invoice.status;
        if (status !== 'paid' && status !== 'success') {
            return { received: true, message: 'Ignored non-paid status' };
        }
        const order = await this.prisma.order.findUnique({
            where: { orderNumber: invoiceNumber },
            include: { tenant: true }
        });
        if (!order) {
            this.logger.warn(`Order not found for invoice_number: ${invoiceNumber}`);
            throw new common_1.NotFoundException('Order not found');
        }
        const tenant = order.tenant;
        if (!tenant.payhookWebhookSecret) {
            this.logger.error(`Tenant ${tenant.username} has no webhook secret`);
            throw new common_1.UnauthorizedException('Tenant is missing webhook secret configuration');
        }
        const expectedSignature = crypto
            .createHmac('sha256', tenant.payhookWebhookSecret)
            .update(rawPayload)
            .digest('hex');
        if (signature !== expectedSignature) {
            this.logger.error(`Invalid webhook signature for order ${invoiceNumber}`);
            throw new common_1.UnauthorizedException('Invalid signature');
        }
        if (order.status === 'PENDING') {
            await this.prisma.order.update({
                where: { id: order.id },
                data: {
                    status: 'CONFIRMED',
                    paymentMethod: body.invoice.payment_channel || 'PAYHOOK',
                }
            });
            this.logger.log(`Order ${invoiceNumber} marked as CONFIRMED`);
            if (tenant.notifMethod === 'WHATSAPP' || tenant.notifMethod === 'BOTH') {
                const msg = `*[TUPPLY PAYMENT]*\nPembayaran untuk pesanan *${order.orderNumber}* telah BERHASIL diterima sejumlah Rp ${order.grandTotal.toLocaleString('id-ID')}.\n\nSilakan proses pesanan ini.`;
                if (tenant.waPhoneNumber) {
                    this.whatsappService.sendMessage(tenant.id, tenant.waPhoneNumber, msg, order.id);
                }
            }
        }
        else {
            this.logger.log(`Order ${invoiceNumber} is already ${order.status}`);
        }
        return { received: true, message: 'Payment processed successfully' };
    }
};
exports.WebhookService = WebhookService;
exports.WebhookService = WebhookService = WebhookService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        whatsapp_service_1.WhatsappService])
], WebhookService);
//# sourceMappingURL=webhook.service.js.map