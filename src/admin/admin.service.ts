import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // Memastikan bahwa user adalah ADMIN
  private async ensureAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Akses ditolak: Hanya Super Admin.');
    }
  }

  async getDashboardStats(userId: string) {
    await this.ensureAdmin(userId);

    const [totalUsers, totalPremium, totalOrders, totalTickets, revenueAggr] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.tenant.count({ where: { isPremium: true } }),
      this.prisma.order.count(),
      this.prisma.ticket.count({ where: { status: 'OPEN' } }),
      this.prisma.subscription.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID' }
      })
    ]);

    const totalRevenue = revenueAggr._sum.amount || 0;

    return { totalUsers, totalPremium, totalOrders, openTickets: totalTickets, totalRevenue };
  }

  async getAllSubscriptions(userId: string) {
    await this.ensureAdmin(userId);
    return this.prisma.subscription.findMany({
      where: { status: 'PAID' },
      include: {
        tenant: {
          include: {
            user: { select: { email: true } }
          }
        }
      },
      orderBy: { paidAt: 'desc' }
    });
  }

  async getAllTenants(userId: string) {
    await this.ensureAdmin(userId);
    return this.prisma.tenant.findMany({
      include: {
        user: { select: { email: true } },
        _count: { select: { orders: true, leads: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async suspendTenant(userId: string, tenantId: string, isSuspended: boolean, reason?: string) {
    await this.ensureAdmin(userId);

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant tidak ditemukan');

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        isSuspended,
        suspendReason: isSuspended ? reason : null
      }
    });
  }

  async getAllTickets(userId: string) {
    await this.ensureAdmin(userId);
    return this.prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateTicketStatus(userId: string, ticketId: string, status: string) {
    await this.ensureAdmin(userId);
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status }
    });
  }

  async getGlobalConfig() {
    const configs = await this.prisma.systemConfig.findMany();
    const configMap: Record<string, string> = {};
    configs.forEach(c => configMap[c.key] = c.value);
    return configMap;
  }

  async updateGlobalConfig(userId: string, data: Record<string, string>) {
    await this.ensureAdmin(userId);
    const updates = Object.entries(data).map(([key, value]) => {
      return this.prisma.systemConfig.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      });
    });
    await this.prisma.$transaction(updates);
    return { success: true, message: 'Configuration updated successfully' };
  }

  async getWithdrawalRequests(userId: string) {
    await this.ensureAdmin(userId);
    return this.prisma.withdrawalRequest.findMany({
      include: {
        tenant: { select: { displayName: true, username: true, waPhoneNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async processWithdrawalRequest(userId: string, requestId: string, proofUrl: string) {
    await this.ensureAdmin(userId);
    
    const request = await this.prisma.withdrawalRequest.findUnique({
      where: { id: requestId }
    });
    if (!request) throw new NotFoundException('Withdrawal request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('Request is already processed');

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.withdrawalRequest.update({
        where: { id: requestId },
        data: {
          status: 'COMPLETED',
          proofUrl
        }
      });

      await tx.walletTransaction.updateMany({
        where: { referenceId: requestId },
        data: { status: 'SUCCESS' }
      });

      return updated;
    });

    return result;
  }
}
