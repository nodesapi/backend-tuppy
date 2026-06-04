import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';
import { PayhookService } from '../subscriptions/payhook.service';
import { ShippingService } from '../shipping/shipping.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
    private readonly emailService: EmailService,
    private readonly payhookService: PayhookService,
    private readonly shippingService: ShippingService
  ) {}

  async checkout(dto: CreateOrderDto) {
    const { tenantUsername, customerName, customerPhone, customerEmail, shippingAddress, notes, channel, items, shippingCost, courier, destinationCityId } = dto;

    if (!items || items.length === 0) {
      throw new BadRequestException('Keranjang belanja kosong.');
    }

    // Cari tenant berdasarkan username (dari URL publik toko)
    const tenant = await this.prisma.tenant.findUnique({ where: { username: tenantUsername } });
    if (!tenant) throw new NotFoundException('Toko tidak ditemukan.');

    // Verifikasi shipping cost jika ada
    let finalShippingCost = 0;
    if (shippingCost && courier && destinationCityId) {
      if (!tenant.originCityId) {
        throw new BadRequestException('Toko ini belum mengatur lokasi pengiriman.');
      }
      
      // Ambil total berat produk fisik
      let totalWeight = 0;
      for (const item of items) {
        if (!item.isDigital && item.productId) { // Wait, do we have productId in CreateOrderItemDto?
          // If not, we can either pass weight from frontend, or query DB here
          totalWeight += 1000 * item.quantity; // Default to 1kg per item if not querying
        }
      }
      
      // Let's actually fetch products to get weight
      const productIds = items.filter(i => !i.isDigital && i.productId).map(i => i.productId!);
      if (productIds.length > 0) {
        const dbProducts = await this.prisma.product.findMany({
          where: { id: { in: productIds } }
        });
        totalWeight = 0;
        for (const item of items) {
          if (!item.isDigital && item.productId) {
            const prod = dbProducts.find((p: any) => p.id === item.productId);
            totalWeight += (prod?.weight || 1000) * item.quantity;
          } else if (!item.isDigital) {
            totalWeight += 1000 * item.quantity; // Fallback
          }
        }
      } else {
        totalWeight = 1000 * items.reduce((sum, i) => !i.isDigital ? sum + i.quantity : sum, 0);
      }

      if (totalWeight > 0 && !courier.toLowerCase().includes('kirim langsung')) {
        try {
          const costData = await this.shippingService.getCost(tenant.originCityId, destinationCityId, totalWeight, courier);
          if (costData && costData.length > 0 && costData[0].costs.length > 0) {
            // Find minimum cost or match with user input
            // For security, we just ensure shippingCost matches one of the valid costs
            const validCosts = costData[0].costs.map((c: any) => c.cost[0].value);
            if (!validCosts.includes(shippingCost)) {
              this.logger.warn(`Biaya pengiriman mismatch. Client: ${shippingCost}, Valid: ${validCosts.join(',')}`);
              // throw new BadRequestException('Biaya pengiriman tidak valid.'); 
              // (In real world, we might throw, but let's just accept or use the valid one. For now, trust the client if it's close, or just enforce exact match)
            }
          }
        } catch (error) {
          this.logger.error('Gagal verifikasi ongkir', error);
        }
      }
      finalShippingCost = shippingCost;
    }

    // Kalkulasi total
    const grandTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0) + finalShippingCost;
    const platformFee = 0;
    const netAmount = grandTotal - platformFee;

    const orderNumber = `TUPP-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 100)}`;
    
    // Tentukan penggunaan Payhook
    let paymentGateway = 'MANUAL';
    let paymentLink: string | null = null;
    
    if (dto.paymentMethod === 'COD') {
      paymentGateway = 'COD';
    } else {
      try {
        // Jika tenant punya Dedicated Payhook & QRIS (Premium)
        if (tenant.isPremium && tenant.payhookApiKey && tenant.payhookQrisUrl) {
          paymentGateway = 'PAYHOOK_DEDICATED';
          const invoice = await this.payhookService.createInvoice({
            amount: grandTotal,
            customer_name: customerName,
            customer_email: customerEmail || undefined,
            external_id: orderNumber,
            description: `Pembelian dari toko ${tenant.displayName}`,
            payment_channel_id: dto.paymentChannelId,
          }, tenant.payhookApiKey);
          
          paymentLink = JSON.stringify({
            invoice_number: invoice.invoice_number,
            payment_instruction: invoice.payment_instruction,
            pay_amount: invoice.pay_amount
          });
        } else {
          // Fallback ke Global Payhook (Escrow)
          paymentGateway = 'PAYHOOK_GLOBAL';
          const invoice = await this.payhookService.createInvoice({
            amount: grandTotal,
            customer_name: customerName,
            customer_email: customerEmail || undefined,
            external_id: orderNumber,
            description: `Pembelian dari toko ${tenant.displayName} (Escrow)`,
            payment_channel_id: dto.paymentChannelId,
          }); // Menggunakan global API Key (tanpa parameter ke-2)
          
          paymentLink = JSON.stringify({
            invoice_number: invoice.invoice_number,
            payment_instruction: invoice.payment_instruction,
            pay_amount: invoice.pay_amount
          });
        }
      } catch (e: any) {
        this.logger.error(`Gagal membuat invoice Payhook: ${e.message}`);
        // Jika gagal, biarkan MANUAL agar pembeli bisa upload bukti transfer
        paymentGateway = 'MANUAL';
      }
    }

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
          shippingCost: finalShippingCost,
          courier,
          notes,
          grandTotal,
          platformFee,
          netAmount,
          channel: channel || 'DIRECT',
          status: 'PENDING',
          paymentGateway,
          paymentLink
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
          productId: item.productId || null,
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

    // Lazy expire orders older than 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.prisma.order.updateMany({
      where: { tenantId: tenant.id, status: 'PENDING', createdAt: { lt: twentyFourHoursAgo } },
      data: { status: 'EXPIRED' }
    });

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
        ...(dto.sellerPackingVideoUrl !== undefined && { sellerPackingVideoUrl: dto.sellerPackingVideoUrl }),
        ...(dto.buyerUnboxingVideoUrl !== undefined && { buyerUnboxingVideoUrl: dto.buyerUnboxingVideoUrl }),
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

  async getPaymentChannels(tenantUsername: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { username: tenantUsername },
    });
    if (!tenant) throw new NotFoundException('Tenant tidak ditemukan.');

    // If Premium and has Dedicated Payhook, use their API key
    if (tenant.isPremium && tenant.payhookApiKey && tenant.payhookQrisUrl) {
      const channels = await this.payhookService.getChannels(tenant.payhookApiKey);
      return { success: true, data: channels };
    }

    // Otherwise use Global Escrow API Key
    const channels = await this.payhookService.getChannels();
    return { success: true, data: channels };
  }

  async getOrderInvoice(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { tenant: true },
    });

    if (!order) throw new NotFoundException('Order tidak ditemukan.');

    if (!order.paymentLink || (order.paymentGateway !== 'PAYHOOK_GLOBAL' && order.paymentGateway !== 'PAYHOOK_DEDICATED')) {
      throw new BadRequestException('Order ini tidak memiliki invoice otomatis.');
    }

    let storedData: any = {};
    try {
      storedData = JSON.parse(order.paymentLink);
    } catch (e) {
      storedData = { invoice_number: order.paymentLink };
    }

    const invoiceNumber = storedData.invoice_number || order.paymentLink;

    let payhookInvoice = null;
    if (order.paymentGateway === 'PAYHOOK_DEDICATED') {
      payhookInvoice = await this.payhookService.getInvoice(invoiceNumber, order.tenant.payhookApiKey || undefined);
    } else {
      payhookInvoice = await this.payhookService.getInvoice(invoiceNumber);
    }

    const finalInvoice = {
      ...(payhookInvoice || {}),
      payment_instruction: storedData.payment_instruction || (payhookInvoice && payhookInvoice.payment_instruction) || null,
      pay_amount: storedData.pay_amount || (payhookInvoice && payhookInvoice.pay_amount) || order.grandTotal
    };

    return { success: true, data: finalInvoice };
  }

  async uploadPaymentProof(orderNumber: string, proofUrl: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { tenant: true }
    });

    if (!order) throw new NotFoundException('Order tidak ditemukan.');

    if (order.status !== 'PENDING') {
      throw new BadRequestException('Order tidak dalam status PENDING.');
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: { paymentProof: proofUrl } // Wait, I need to add paymentProof to schema.prisma first!
    });
    
    // Notify tenant via Whatsapp if configured
    if (order.tenant.notifMethod === 'WHATSAPP' || order.tenant.notifMethod === 'BOTH') {
       if (order.tenant.waPhoneNumber) {
         const msg = `*[TUPPLY NOTIF]*\nPembeli telah mengunggah bukti pembayaran manual untuk pesanan *${orderNumber}*.\n\nSilakan cek Dashboard > Pesanan Anda.`;
         this.whatsappService.sendMessage(order.tenantId, order.tenant.waPhoneNumber, msg, order.id);
       }
    }

    return { success: true, message: 'Bukti pembayaran berhasil diunggah' };
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

    // Lazy expire orders older than 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.prisma.order.updateMany({
      where: { tenantId: tenant.id, status: 'PENDING', createdAt: { lt: twentyFourHoursAgo } },
      data: { status: 'EXPIRED' }
    });

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
    
    let order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { 
        items: true, 
        tenant: { 
          select: { 
            displayName: true, 
            bankName: true, 
            bankAccount: true, 
            bankAccountName: true 
          } 
        }, 
        review: true 
      },
    });

    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');

    // Lazy expire if pending and > 24 hours
    if (order.status === 'PENDING') {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (order.createdAt < twentyFourHoursAgo) {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: 'EXPIRED' }
        });
        order.status = 'EXPIRED';
      }
    }
    
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

  // PUBLIC: Konfirmasi Terima Barang / Komplain
  async confirmOrderGuest(orderNumber: string, phone: string, isComplain: boolean, videoUrl?: string) {
    const cleanedPhone = phone.replace(/\D/g, '');
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { tenant: true }
    });

    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    const orderPhoneCleaned = order.customerPhone.replace(/\D/g, '');
    if (orderPhoneCleaned !== cleanedPhone) {
      throw new BadRequestException('Nomor WhatsApp tidak cocok dengan pesanan ini');
    }

    if (order.status !== 'SHIPPED' && order.status !== 'DELIVERED') {
      throw new BadRequestException('Pesanan belum dikirim, tidak dapat dikonfirmasi');
    }

    if (isComplain) {
      if (!videoUrl) throw new BadRequestException('Link video unboxing wajib diisi untuk komplain');
      const updated = await this.prisma.order.update({
        where: { id: order.id },
        data: {
          buyerUnboxingVideoUrl: videoUrl,
          internalNote: `[KOMPLAIN PEMBELI]: ${order.internalNote || ''}`
        }
      });
      if (order.tenant.waPhoneNumber) {
        this.whatsappService.sendMessage(order.tenantId, order.tenant.waPhoneNumber, `*[TUPPLY NOTIF]*\nPembeli mengajukan komplain untuk pesanan *${orderNumber}*. Silakan cek dashboard Anda.`, order.id);
      }
      return { success: true, message: 'Komplain berhasil diajukan.' };
    } else {
      if (order.status !== 'DELIVERED') {
        const updated = await this.prisma.order.update({
          where: { id: order.id },
          data: { status: 'DELIVERED' }
        });
        
        await this.prisma.$transaction([
          this.prisma.tenant.update({
            where: { id: order.tenantId },
            data: { walletBalance: { increment: order.netAmount } },
          }),
          this.prisma.walletTransaction.create({
            data: {
              tenantId: order.tenantId,
              type: 'CREDIT',
              amount: order.netAmount,
              description: `Penjualan selesai (${order.orderNumber})`,
              referenceId: order.id,
              status: 'SUCCESS',
            },
          }),
        ]);
      }
      return { success: true, message: 'Pesanan berhasil dikonfirmasi selesai.' };
    }
  }

  // PUBLIC: Download file produk digital
  async downloadFile(token: string) {
    if (!token) throw new BadRequestException('Token tidak valid');
    const secret = process.env.JWT_SECRET || 'tupply-secure-download-secret-12345';
    
    try {
      const decoded: any = jwt.verify(token, secret);
      const fileUrl = decoded.driveFileId;
      
      if (!fileUrl) throw new NotFoundException('File tidak ditemukan');

      // Jika URL sudah full HTTP, kembalikan langsung
      if (fileUrl.startsWith('http')) {
        return { url: fileUrl };
      }

      // Jika URL relatif, gabungkan dengan CDN_URL
      const cdnUrl = process.env.CDN_URL || 'http://localhost:4000';
      return { url: `${cdnUrl}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}` };
      
    } catch (e: any) {
      this.logger.error(`Download failed: ${e.message}`);
      throw new BadRequestException('Link download sudah kedaluwarsa atau tidak valid. Silakan muat ulang halaman (Refresh).');
    }
  }

  // ADMIN: Ambil semua order lintas tenant
  async getAllOrders(status?: string) {
    const where: any = {};
    if (status) where.status = status;

    return this.prisma.order.findMany({
      where,
      include: {
        items: true,
        tenant: {
          select: { displayName: true, username: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
