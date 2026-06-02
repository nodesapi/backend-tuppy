import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTicket(data: {
    senderEmail: string;
    senderName: string;
    subject: string;
    message: string;
    type?: string;
    targetId?: string;
  }) {
    return this.prisma.ticket.create({
      data: {
        senderEmail: data.senderEmail,
        senderName: data.senderName,
        subject: data.subject,
        message: data.message,
        type: data.type || 'SUPPORT',
        targetId: data.targetId,
      }
    });
  }
}
