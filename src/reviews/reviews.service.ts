import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async createReview(
    orderNumber: string,
    phone: string,
    rating: number,
    comment?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
    });

    if (!order) {
      throw new NotFoundException('Pesanan tidak ditemukan');
    }

    // Convert both to lower/trim for safe matching
    if (order.customerPhone.trim() !== phone.trim()) {
      throw new UnauthorizedException(
        'Nomor WhatsApp tidak cocok dengan data pesanan',
      );
    }

    if (order.status !== 'DELIVERED') {
      throw new BadRequestException(
        'Ulasan hanya bisa diberikan untuk pesanan yang sudah selesai atau dikirim.',
      );
    }

    const existingReview = await this.prisma.review.findUnique({
      where: { orderId: order.id },
    });

    if (existingReview) {
      throw new BadRequestException(
        'Pesanan ini sudah diberikan ulasan sebelumnya.',
      );
    }

    const review = await this.prisma.review.create({
      data: {
        tenantId: order.tenantId,
        orderId: order.id,
        rating,
        comment,
      },
    });

    return {
      message: 'Ulasan berhasil disimpan',
      review,
    };
  }

  async getTenantReviews(tenantId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { tenantId },
      include: {
        order: {
          select: {
            customerName: true,
            items: {
              select: { productName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to recent 50 for now
    });
    return reviews;
  }
}
