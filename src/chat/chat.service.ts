import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  BuyerChatMessageDto,
  SellerChatMessageDto,
  SellerConversationQueryDto,
  StartConversationDto,
} from './dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePhone(phone: string) {
    return `${phone || ''}`.replace(/[^\d]/g, '');
  }

  private sanitizeText(text?: string | null) {
    const value = `${text || ''}`.trim();
    return value.length > 0 ? value : null;
  }

  private resolveMessageType(text?: string | null, attachmentUrl?: string | null) {
    if (attachmentUrl) return 'IMAGE';
    if (text) return 'TEXT';
    return 'SYSTEM';
  }

  private async getTenantByUser(userId: string) {
    return this.prisma.tenant.findUnique({ where: { userId } });
  }

  private mapConversation(conversation: any) {
    const latestMessage = conversation.messages?.[0] || null;
    return {
      id: conversation.id,
      customerName: conversation.customerName,
      customerPhone: conversation.customerPhone,
      customerEmail: conversation.customerEmail,
      status: conversation.status,
      unreadSellerCount: conversation.unreadSellerCount,
      unreadBuyerCount: conversation.unreadBuyerCount,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      order: conversation.order
        ? {
            id: conversation.order.id,
            orderNumber: conversation.order.orderNumber,
            status: conversation.order.status,
            grandTotal: conversation.order.grandTotal,
            createdAt: conversation.order.createdAt,
          }
        : null,
      latestMessage: latestMessage
        ? {
            id: latestMessage.id,
            senderType: latestMessage.senderType,
            senderName: latestMessage.senderName,
            messageType: latestMessage.messageType,
            text: latestMessage.text,
            attachmentUrl: latestMessage.attachmentUrl,
            attachmentName: latestMessage.attachmentName,
            createdAt: latestMessage.createdAt,
          }
        : null,
    };
  }

  private mapMessage(message: any) {
    return {
      id: message.id,
      senderType: message.senderType,
      senderName: message.senderName,
      messageType: message.messageType,
      text: message.text,
      attachmentUrl: message.attachmentUrl,
      attachmentName: message.attachmentName,
      attachmentMimeType: message.attachmentMimeType,
      attachmentSize: message.attachmentSize,
      createdAt: message.createdAt,
    };
  }

  private async getConversationForBuyerAccess(
    conversationId: string,
    guestToken?: string,
    orderNumber?: string,
    customerPhone?: string,
  ) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: {
        order: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Percakapan tidak ditemukan.');
    }

    if (guestToken && conversation.guestToken === guestToken) {
      return conversation;
    }

    if (orderNumber && customerPhone && conversation.order?.orderNumber === orderNumber) {
      const normalizedPhone = this.normalizePhone(customerPhone);
      if (normalizedPhone && normalizedPhone === this.normalizePhone(conversation.customerPhone)) {
        return conversation;
      }
    }

    throw new BadRequestException('Akses percakapan tidak valid.');
  }

  async startConversation(dto: StartConversationDto) {
    const normalizedPhone = this.normalizePhone(dto.customerPhone);
    if (!normalizedPhone) {
      throw new BadRequestException('Nomor HP wajib diisi.');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { username: dto.tenantUsername },
    });

    if (!tenant) {
      throw new NotFoundException('Toko tidak ditemukan.');
    }

    const existing = await this.prisma.chatConversation.findFirst({
      where: {
        tenantId: tenant.id,
        customerPhone: normalizedPhone,
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
      include: {
        order: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const conversation = existing
      ? await this.prisma.chatConversation.update({
          where: { id: existing.id },
          data: {
            customerName: dto.customerName.trim(),
            customerPhone: normalizedPhone,
            customerEmail: dto.customerEmail?.trim() || existing.customerEmail,
          },
          include: {
            order: true,
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        })
      : await this.prisma.chatConversation.create({
          data: {
            tenantId: tenant.id,
            customerName: dto.customerName.trim(),
            customerPhone: normalizedPhone,
            customerEmail: dto.customerEmail?.trim() || null,
            guestToken: randomUUID(),
          },
          include: {
            order: true,
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return {
      conversation: {
        ...this.mapConversation(conversation),
        guestToken: conversation.guestToken,
      },
      messages: messages.map((message) => this.mapMessage(message)),
    };
  }

  async getConversationForBuyer(
    conversationId: string,
    guestToken?: string,
    orderNumber?: string,
    customerPhone?: string,
  ) {
    const conversation = await this.getConversationForBuyerAccess(
      conversationId,
      guestToken,
      orderNumber,
      customerPhone,
    );

    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    if (conversation.unreadBuyerCount > 0) {
      await this.prisma.chatConversation.update({
        where: { id: conversation.id },
        data: { unreadBuyerCount: 0 },
      });
    }

    return {
      conversation: {
        ...this.mapConversation({ ...conversation, messages: [] }),
        guestToken: conversation.guestToken,
      },
      messages: messages.map((message) => this.mapMessage(message)),
    };
  }

  async getConversationByOrder(orderNumber: string, customerPhone: string) {
    const normalizedPhone = this.normalizePhone(customerPhone);
    if (!normalizedPhone) {
      throw new BadRequestException('Nomor HP wajib diisi.');
    }

    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        customerPhone: normalizedPhone,
        order: {
          is: {
            orderNumber,
          },
        },
      },
      include: {
        order: true,
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });

    if (!conversation) {
      throw new NotFoundException('Percakapan untuk pesanan ini belum tersedia.');
    }

    return this.getConversationForBuyer(conversation.id, undefined, orderNumber, normalizedPhone);
  }

  async sendBuyerMessage(conversationId: string, dto: BuyerChatMessageDto) {
    const text = this.sanitizeText(dto.text);
    if (!text && !dto.attachmentUrl) {
      throw new BadRequestException('Pesan atau lampiran wajib diisi.');
    }

    const conversation = await this.getConversationForBuyerAccess(
      conversationId,
      dto.guestToken,
      dto.orderNumber,
      dto.customerPhone,
    );

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: {
          conversationId: conversation.id,
          senderType: 'BUYER',
          senderName: conversation.customerName,
          messageType: this.resolveMessageType(text, dto.attachmentUrl),
          text,
          attachmentUrl: dto.attachmentUrl || null,
          attachmentName: dto.attachmentName || null,
          attachmentMimeType: dto.attachmentMimeType || null,
        },
      });

      await tx.chatConversation.update({
        where: { id: conversation.id },
        data: {
          customerName: conversation.customerName,
          status: 'PENDING_SELLER',
          unreadSellerCount: { increment: 1 },
          lastMessageAt: created.createdAt,
        },
      });

      return created;
    });

    return this.mapMessage(message);
  }

  async getMyConversations(userId: string, query?: SellerConversationQueryDto) {
    const tenant = await this.getTenantByUser(userId);
    if (!tenant) return [];

    const normalizedSearch = query?.search?.trim();
    const where: any = { tenantId: tenant.id };

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.onlyUnread === 'true') {
      where.unreadSellerCount = { gt: 0 };
    }

    if (normalizedSearch) {
      where.OR = [
        { customerName: { contains: normalizedSearch, mode: 'insensitive' } },
        { customerPhone: { contains: normalizedSearch } },
        { order: { is: { orderNumber: { contains: normalizedSearch, mode: 'insensitive' } } } },
      ];
    }

    const conversations = await this.prisma.chatConversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        order: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      take: 100,
    });

    return conversations.map((conversation) => this.mapConversation(conversation));
  }

  async getUnreadCount(userId: string) {
    const tenant = await this.getTenantByUser(userId);
    if (!tenant) return { total: 0 };

    const aggregate = await this.prisma.chatConversation.aggregate({
      where: { tenantId: tenant.id },
      _sum: { unreadSellerCount: true },
    });

    return { total: aggregate._sum.unreadSellerCount || 0 };
  }

  async getMyConversation(userId: string, conversationId: string) {
    const tenant = await this.getTenantByUser(userId);
    if (!tenant) {
      throw new NotFoundException('Tenant tidak ditemukan.');
    }

    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        tenantId: tenant.id,
      },
      include: {
        order: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Percakapan tidak ditemukan.');
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    if (conversation.unreadSellerCount > 0) {
      await this.prisma.chatConversation.update({
        where: { id: conversation.id },
        data: { unreadSellerCount: 0 },
      });
    }

    return {
      conversation: this.mapConversation({ ...conversation, messages: [] }),
      messages: messages.map((message) => this.mapMessage(message)),
    };
  }

  async sendSellerMessage(userId: string, conversationId: string, dto: SellerChatMessageDto) {
    const tenant = await this.getTenantByUser(userId);
    if (!tenant) {
      throw new NotFoundException('Tenant tidak ditemukan.');
    }

    const text = this.sanitizeText(dto.text);
    if (!text && !dto.attachmentUrl) {
      throw new BadRequestException('Pesan atau lampiran wajib diisi.');
    }

    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        tenantId: tenant.id,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Percakapan tidak ditemukan.');
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: {
          conversationId,
          senderType: 'SELLER',
          senderName: tenant.displayName,
          messageType: this.resolveMessageType(text, dto.attachmentUrl),
          text,
          attachmentUrl: dto.attachmentUrl || null,
          attachmentName: dto.attachmentName || null,
          attachmentMimeType: dto.attachmentMimeType || null,
        },
      });

      await tx.chatConversation.update({
        where: { id: conversationId },
        data: {
          status: 'PENDING_BUYER',
          unreadBuyerCount: { increment: 1 },
          unreadSellerCount: 0,
          lastMessageAt: created.createdAt,
        },
      });

      return created;
    });

    return this.mapMessage(message);
  }

  async linkOrderToConversation(params: {
    tenantId: string;
    orderId: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string | null;
  }) {
    const normalizedPhone = this.normalizePhone(params.customerPhone);
    if (!normalizedPhone) return null;

    const latestConversation = await this.prisma.chatConversation.findFirst({
      where: {
        tenantId: params.tenantId,
        customerPhone: normalizedPhone,
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    const systemText = `Pesanan ${params.orderNumber} berhasil dibuat. Anda bisa lanjut chat di sini untuk tanya status pembelian.`;

    return this.prisma.$transaction(async (tx) => {
      const conversation = latestConversation
        ? await tx.chatConversation.update({
            where: { id: latestConversation.id },
            data: {
              orderId: params.orderId,
              customerName: params.customerName,
              customerPhone: normalizedPhone,
              customerEmail: params.customerEmail || latestConversation.customerEmail,
              status: 'OPEN',
            },
          })
        : await tx.chatConversation.create({
            data: {
              tenantId: params.tenantId,
              orderId: params.orderId,
              customerName: params.customerName,
              customerPhone: normalizedPhone,
              customerEmail: params.customerEmail || null,
              guestToken: randomUUID(),
              status: 'OPEN',
            },
          });

      const systemMessage = await tx.chatMessage.create({
        data: {
          conversationId: conversation.id,
          senderType: 'SYSTEM',
          senderName: 'Tupply',
          messageType: 'SYSTEM',
          text: systemText,
        },
      });

      await tx.chatConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: systemMessage.createdAt,
        },
      });

      return conversation;
    });
  }
}
