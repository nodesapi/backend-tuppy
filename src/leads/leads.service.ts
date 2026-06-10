import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLeadStatusDto } from '../orders/dto/update-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyLeads(userId: string, source?: string, status?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) return [];

    const where: any = { tenantId: tenant.id };
    if (source) where.source = source;
    if (status) where.status = status;

    const leads = await this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const invitations = await this.prisma.invitation.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, slug: true, title: true },
    });

    const invMap = new Map();
    invitations.forEach((inv) => invMap.set(`invitation-${inv.id}`, inv));

    return leads.map((lead) => {
      if (lead.blockId && lead.blockId.startsWith('invitation-')) {
        const inv = invMap.get(lead.blockId);
        if (inv) {
          return {
            ...lead,
            invitationSlug: inv.slug,
            invitationTitle: inv.title,
          };
        }
      }
      return lead;
    });
  }

  async updateLeadStatus(
    leadId: string,
    dto: UpdateLeadStatusDto,
    userId: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant tidak ditemukan.');

    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId: tenant.id },
    });
    if (!lead) throw new NotFoundException('Lead tidak ditemukan.');

    return this.prisma.lead.update({
      where: { id: leadId },
      data: {
        status: dto.status,
        ...(dto.internalNote !== undefined && {
          internalNote: dto.internalNote,
        }),
      },
    });
  }

  // Hitung semua pending items (order + lead NEW) untuk badge sidebar
  async getInboxCount(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) return { orders: 0, leads: 0, total: 0 };

    const [orders, leads] = await Promise.all([
      this.prisma.order.count({
        where: { tenantId: tenant.id, status: 'PENDING' },
      }),
      this.prisma.lead.count({ where: { tenantId: tenant.id, status: 'NEW' } }),
    ]);

    return { orders, leads, total: orders + leads };
  }
}
