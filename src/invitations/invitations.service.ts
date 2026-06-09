import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvitationsService {
  constructor(private prisma: PrismaService) {}

  async getMyInvitation(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId }
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    let invitation = await this.prisma.invitation.findFirst({
      where: { tenantId: tenant.id },
      include: { guests: true }
    });

    return invitation;
  }

  async saveInvitation(userId: string, data: any) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId }
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.invitation.findFirst({
      where: { tenantId: tenant.id }
    });

    let slug = existing?.slug;
    
    // Allow custom slug from frontend
    if (data.slug && data.slug.trim() !== '') {
      const requestedSlug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
      // Check if the requested slug is taken by ANOTHER invitation
      const checkSlug = await this.prisma.invitation.findUnique({ where: { slug: requestedSlug } });
      if (checkSlug && checkSlug.id !== existing?.id) {
        throw new Error('SLUG_TAKEN');
      }
      slug = requestedSlug;
    }

    if (!slug) {
      // Generate slug based on groom and bride nicknames
      const groomName = data.groom?.nickname || 'romeo';
      const brideName = data.bride?.nickname || 'juliet';
      slug = `${groomName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${brideName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      
      // Ensure uniqueness
      let checkSlug = await this.prisma.invitation.findUnique({ where: { slug } });
      if (checkSlug && checkSlug.id !== existing?.id) {
        slug = `${slug}-${Math.floor(Math.random() * 10000)}`;
      }
    }

    const payload = {
      tenantId: tenant.id,
      slug,
      themeId: data.themeId || 'theme-classic',
      animation: data.animation || 'none',
      title: data.title || `Pernikahan ${data.groom?.nickname || 'Romeo'} & ${data.bride?.nickname || 'Juliet'}`,
      groom: data.groom || {},
      bride: data.bride || {},
      quote: data.quote || {},
      events: data.events || {},
      banks: data.banks || [],
      gallery: data.gallery || [],
      musicUrl: data.musicUrl || '',
      backgroundUrl: data.backgroundUrl || '',
      qrisImage: data.qrisImage || '',
      design: data.design || {},
      isActive: true
    };

    let invitation;
    if (existing) {
      invitation = await this.prisma.invitation.update({
        where: { id: existing.id },
        data: payload
      });
    } else {
      invitation = await this.prisma.invitation.create({
        data: payload
      });
    }

    // Handle guests sync (simple replace for now)
    if (data.guests && Array.isArray(data.guests)) {
      await this.prisma.invitationGuest.deleteMany({
        where: { invitationId: invitation.id }
      });
      
      if (data.guests.length > 0) {
        await this.prisma.invitationGuest.createMany({
          data: data.guests.map((g: any) => ({
            invitationId: invitation.id,
            name: g.name,
            phone: g.phone || '',
            status: g.status || 'Belum'
          }))
        });
      }
    }

    return this.prisma.invitation.findUnique({
      where: { id: invitation.id },
      include: { guests: true }
    });
  }

  async getPublicInvitation(slug: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { slug }
    });
    if (!invitation || !invitation.isActive) {
      throw new NotFoundException('Undangan tidak ditemukan atau sudah tidak aktif');
    }
    return invitation;
  }

  async getMusicPresets() {
    return this.prisma.invitationMusic.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async getBackgroundPresets() {
    return this.prisma.invitationBackground.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async submitRsvp(slug: string, payload: any) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { slug }
    });
    if (!invitation) throw new NotFoundException('Undangan tidak ditemukan');

    // Buat record di tabel Lead agar masuk ke inbox
    const lead = await this.prisma.lead.create({
      data: {
        tenantId: invitation.tenantId,
        blockId: 'rsvp-form',
        source: 'RSVP',
        name: payload.name || 'Tamu',
        notes: payload.wish || '',
        status: payload.attendance === 'yes' ? 'Hadir' : (payload.attendance === 'no' ? 'Tidak Hadir' : 'Ragu'),
      }
    });

    return { success: true, lead };
  }

  async getRsvps(slug: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { slug }
    });
    if (!invitation) throw new NotFoundException('Undangan tidak ditemukan');

    return this.prisma.lead.findMany({
      where: {
        tenantId: invitation.tenantId,
        source: 'RSVP'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async upgradeWithWallet(userId: string, id: string, plan: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const invitation = await this.prisma.invitation.findFirst({
      where: { id, tenantId: tenant.id }
    });
    if (!invitation) throw new NotFoundException('Invitation not found');

    // Dynamic Pricing from SystemConfig
    const configs = await this.prisma.systemConfig.findMany({
      where: { key: { in: ['EVENT_PRICING_3M_WALLET', 'EVENT_PRICING_6M_WALLET', 'EVENT_PRICING_12M_WALLET'] } }
    });
    const pricing = {
      'EVENT_3_MONTHS': 35000,
      'EVENT_6_MONTHS': 70000,
      'EVENT_12_MONTHS': 100000,
    };
    for (const c of configs) {
      if (c.key === 'EVENT_PRICING_3M_WALLET') pricing['EVENT_3_MONTHS'] = parseInt(c.value);
      if (c.key === 'EVENT_PRICING_6M_WALLET') pricing['EVENT_6_MONTHS'] = parseInt(c.value);
      if (c.key === 'EVENT_PRICING_12M_WALLET') pricing['EVENT_12_MONTHS'] = parseInt(c.value);
    }

    let amount = 0;
    let additionalMonths = 0;

    if (plan === 'EVENT_3_MONTHS') { amount = pricing['EVENT_3_MONTHS']; additionalMonths = 3; }
    else if (plan === 'EVENT_6_MONTHS') { amount = pricing['EVENT_6_MONTHS']; additionalMonths = 6; }
    else if (plan === 'EVENT_12_MONTHS') { amount = pricing['EVENT_12_MONTHS']; additionalMonths = 12; }
    else throw new BadRequestException('Invalid EVENT plan');

    if (tenant.walletBalance < amount) {
      throw new BadRequestException('Saldo Wallet tidak mencukupi untuk pembayaran ini');
    }

    // Execute with transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Potong Saldo
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { walletBalance: { decrement: amount } }
      });

      // 2. Catat Mutasi
      await tx.walletTransaction.create({
        data: {
          tenantId: tenant.id,
          type: 'DEBIT',
          amount: amount,
          description: `Bayar Langganan Undangan (${plan.replace('EVENT_', '').replace('_', ' ')})`,
          status: 'SUCCESS'
        }
      });

      // 3. Tambah Masa Aktif
      const currentExpiry = invitation.activeUntil && invitation.activeUntil > new Date() ? invitation.activeUntil : new Date();
      const newExpiry = new Date(currentExpiry);
      newExpiry.setMonth(newExpiry.getMonth() + additionalMonths);

      const updatedInv = await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          isPremium: true,
          activeUntil: newExpiry,
          premiumPackage: plan,
          isActive: true
        }
      });

      return updatedInv;
    });

    return { success: true, message: 'Upgrade berhasil menggunakan saldo wallet', invitation: result };
  }
}

