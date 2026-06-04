import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
    private readonly emailService: EmailService
  ) {}

  async checkout(dto: CreateOrderDto) {
    const { tenantUsername, customerName, customerPhone, customerEmail, shippingAddress, notes, channel, items } = dto;

    if (!items || items.length === 0) {
      throw new BadRequestException('Keranjang belanja kosong.');
    }

    // Cari tenant berdasarkan username (dari URL publik toko)
    const tenant = await this.prisma.tenant.findUnique({ where: { username: tenantUsername } });
    if (!tenant) throw new NotFoundException('Toko tidak ditemukan.');

    // Kalkulasi total
    const grandTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    // Fee hanya berlaku jika transaksi via payment gateway Tupply (saat ini 0)
    const platformFee = 0;
    const netAmount = grandTotal - platformFee;

    const orderNumber = `TUPP-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 100)}`;

    const result = await this.prisma.$transaction(async (tx) => {
      // Buat Order utama
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

      // Buat semua OrderItem
      await tx.orderItem.createMany({
        data: items.map((item: any) => ({
          orderId: order.id,
          blockId: item.blockId,
          productName: item.productName,
          imageUrl: item.imageUrl,
          price: item.price,
          quantity: item.quantity,
          subtotal: item.price * item.quantity,
          isDigital: item.isDigital || false,
          digitalFileId: item.digitalFileId || null,
        })),
      });

      return order;
    });

    // Fetch order lengkap dengan items untuk response
    const fullOrder = await this.prisma.order.findUnique({
      where: { id: result.id },
      include: { items: true },
    });

    // Generate link WA konfirmasi ke penjual (hanya untuk dicopy jika perlu)
    const waText = this.generateWaText(fullOrder!, tenant.waPhoneNumber);

    const frontendDomain = process.env.FRONTEND_URL || 'http://localhost:3001';
    const trackingLink = `${frontendDomain}/track/${orderNumber}`;

    // Jalur WHATSAPP
    if (tenant.notifMethod === 'WHATSAPP' || tenant.notifMethod === 'BOTH') {
      const sellerMsg = `*[TUPPLY NOTIF]*\nAda pesanan baru masuk! 🎉\n\n*No. Order:* ${orderNumber}\n*Pembeli:* ${customerName}\n*Total:* Rp ${grandTotal.toLocaleString('id-ID')}\n\nSilakan cek dashboard Tupply Anda untuk detail lebih lanjut.`;
      
      // Ke Penjual (Notif admin internal penjual)
      if (tenant.waPhoneNumber) {
        this.whatsappService.sendMessage(tenant.id, tenant.waPhoneNumber, sellerMsg, result.id);
      }

      // Ke Pembeli (Struk)
      const buyerMsg = `Halo *${customerName}*, terima kasih telah berbelanja di *${tenant.displayName}*! 🛍️\n\nPesanan Anda dengan nomor *${orderNumber}* telah kami simpan.\n\nUntuk melacak status pengiriman (resi), klik:\n🌐 ${trackingLink}\n\nTerima kasih,\n${tenant.displayName}`;
      this.whatsappService.sendMessage(tenant.id, customerPhone, buyerMsg, result.id);
    }

    // Jalur EMAIL
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

  async getMyOrders(userId: string, status?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) return [];

    const where: any = { tenantId: tenant.id };
    if (status) where.status = status;

    return this.prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderDetail(orderId: string, userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant tidak ditemukan.');

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId: tenant.id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order tidak ditemukan.');

    // Generate Download Tokens for Digital Items if Paid
    let downloadTokens: any[] = [];
    if (order.status === 'DELIVERED' || order.status === 'PROCESSING' || order.status === 'CONFIRMED') {
      const digitalItems = order.items.filter((item: any) => item.isDigital && item.digitalFileId);
      const secret = process.env.JWT_SECRET || 'tupply-secure-download-secret-12345';
      
      downloadTokens = digitalItems.map(item => ({
        itemId: item.id,
        productName: item.productName,
        token: jwt.sign({
          orderId: order.id,
          productId: item.id,
          driveFileId: item.digitalFileId
        }, secret, { expiresIn: '5m' })
      }));
    }

    return { ...order, downloadTokens };
  }

  async updateOrderStatus(orderId: string, dto: UpdateOrderStatusDto, userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant tidak ditemukan.');

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId: tenant.id },
    });
    if (!order) throw new NotFoundException('Order tidak ditemukan.');

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

    // Jika baru selesai (DELIVERED), kredit wallet
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
    
    // Jika pesanan dikirim, beri tahu pembeli
    if ((dto.status === 'PROCESSING' || dto.status === 'DELIVERED') && dto.awbNumber && order.status !== dto.status) {
      const frontendDomain = process.env.FRONTEND_URL || 'http://localhost:3001';
      const trackingLink = `${frontendDomain}/track/${order.orderNumber}`;
      
      if (tenant.notifMethod === 'WHATSAPP' || tenant.notifMethod === 'BOTH') {
        const msg = `Halo *${order.customerName}*, pesanan Anda dengan nomor *${order.orderNumber}* sedang *${dto.status === 'DELIVERED' ? 'Dikirim/Selesai' : 'Diproses'}*.\n\nKurir: *${dto.courier || '-'}*\nResi: *${dto.awbNumber}*\n\nCek pesanan: ${trackingLink}`;
        this.whatsappService.sendMessage(tenant.id, order.customerPhone, msg, order.id);
      }
      
      // Jika mode email, idealnya kita tambahkan fitur update status email juga (tapi sementara fokus WA/Struk awal).
    }

    return updated;
  }

  private generateWaText(order: any, tenantPhone?: string | null) {
    const itemList = order.items
      .map((i: any) => `• ${i.productName} x${i.quantity} = Rp ${i.subtotal.toLocaleString('id-ID')}`)
      .join('\n');

    const text = `Halo! Saya baru saja melakukan pesanan di toko Anda 🛍️\n\n*No. Order:* ${order.orderNumber}\n*Nama:* ${order.customerName}\n*No. WA:* ${order.customerPhone}\n\n*Detail Pesanan:*\n${itemList}\n\n*Total: Rp ${order.grandTotal.toLocaleString('id-ID')}*\n\nMohon konfirmasi pesanan saya. Terima kasih!`;

    const encodedText = encodeURIComponent(text);
    const phone = tenantPhone?.replace(/\D/g, '').replace(/^0/, '62');
    const link = phone ? `https://wa.me/${phone}?text=${encodedText}` : null;

    return { text, link };
  }

  // Hitung jumlah order PENDING untuk badge di sidebar dashboard
  async getPendingCount(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) return { count: 0 };

    const count = await this.prisma.order.count({
      where: { tenantId: tenant.id, status: 'PENDING' },
    });

    return { count };
  }

  // PUBLIC: Lacak pesanan berdasarkan order number & phone
  async trackOrder(orderNumber: string, phone: string) {
    if (!orderNumber || !phone) throw new BadRequestException('Nomor pesanan dan WhatsApp wajib diisi');
    
    // Clean phone number untuk perbandingan yang lebih aman
    const cleanedPhone = phone.replace(/\D/g, '');
    
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true, tenant: { select: { displayName: true } }, review: true },
    });

    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    
    // Verifikasi nomor HP
    const orderPhoneCleaned = order.customerPhone.replace(/\D/g, '');
    if (orderPhoneCleaned !== cleanedPhone) {
      throw new BadRequestException('Nomor WhatsApp tidak cocok dengan pesanan ini');
    }

    // Generate Download Tokens for Digital Items if Paid
    let downloadTokens: any[] = [];
    if (order.status === 'DELIVERED' || order.status === 'PROCESSING' || order.status === 'CONFIRMED') {
      const digitalItems = order.items.filter((item: any) => item.isDigital && item.digitalFileId);
      const secret = process.env.JWT_SECRET || 'tupply-secure-download-secret-12345';
      
      downloadTokens = digitalItems.map(item => ({
        itemId: item.id,
        productName: item.productName,
        token: jwt.sign({
          orderId: order.id,
          productId: item.id,
          driveFileId: item.digitalFileId
        }, secret, { expiresIn: '5m' })
      }));
    }

    return { ...order, downloadTokens };
  }
}
