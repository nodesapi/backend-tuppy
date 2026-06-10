import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTicket(data: {
    tenantId?: string;
    senderEmail: string;
    senderName: string;
    subject: string;
    message: string;
    type?: string;
    targetId?: string;
  }) {
    return this.prisma.ticket.create({
      data: {
        tenantId: data.tenantId,
        senderEmail: data.senderEmail,
        senderName: data.senderName,
        subject: data.subject,
        message: data.message,
        type: data.type || 'SUPPORT',
        targetId: data.targetId,
      },
    });
  }

  async getTicketsByUserId(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return this.prisma.ticket.findMany({
      where: { tenantId: tenant.id },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getTicketDetail(userId: string, ticketId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId: tenant.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async replyTicket(userId: string, ticketId: string, messageText: string) {
    const ticket = await this.getTicketDetail(userId, ticketId);

    if (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') {
      throw new BadRequestException(
        'Tiket sudah ditutup dan tidak dapat dibalas lagi.',
      );
    }

    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        senderType: 'USER',
        message: messageText,
      },
    });

    // Update ticket updatedAt
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });

    return message;
  }
}
