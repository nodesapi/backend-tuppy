import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

    const [totalUsers, totalPremium, totalOrders, totalTickets] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.tenant.count({ where: { isPremium: true } }),
      this.prisma.order.count(),
      this.prisma.ticket.count({ where: { status: 'OPEN' } }),
    ]);

    return { totalUsers, totalPremium, totalOrders, openTickets: totalTickets };
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
}
