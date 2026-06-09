import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvitationsService {
  constructor(private prisma: PrismaService) {}

  async getInvitations(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId }
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return this.prisma.invitation.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getInvitationById(userId: string, id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId }
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const invitation = await this.prisma.invitation.findFirst({
      where: { id, tenantId: tenant.id },
      include: { guests: true }
    });
    if (!invitation) throw new NotFoundException('Invitation not found');

    return invitation;
  }

  async checkSlug(slug: string) {
    const requestedSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const checkSlug = await this.prisma.invitation.findUnique({ where: { slug: requestedSlug } });
    if (checkSlug) {
      return { available: false };
    }
    return { available: true, slug: requestedSlug };
  }

  async createInvitation(userId: string, data: any) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId }
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    let slug = data.slug;
    if (!slug) throw new BadRequestException('Slug is required');
    
    slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const checkSlug = await this.prisma.invitation.findUnique({ where: { slug } });
    if (checkSlug) {
      throw new BadRequestException('SLUG_TAKEN');
    }

    // 7-day trial
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    const payload = {
      tenantId: tenant.id,
      slug,
      themeId: data.themeId || 'theme-classic',
      animation: 'none',
      title: data.title || `Undangan ${slug}`,
      groom: {},
      bride: {},
      quote: {},
      events: {},
      banks: [],
      gallery: [],
      musicUrl: '',
      backgroundUrl: '',
      qrisImage: '',
      design: {},
      isActive: true,
      isPremium: false,
      activeUntil: trialEndDate,
      premiumPackage: 'FREE_TRIAL'
    };

    const invitation = await this.prisma.invitation.create({
      data: payload
    });

    return invitation;
  }

  async updateInvitation(userId: string, id: string, data: any) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId }
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.invitation.findFirst({
      where: { id, tenantId: tenant.id }
    });
    if (!existing) throw new NotFoundException('Invitation not found');

    let slug = existing.slug;
    if (data.slug && data.slug.trim() !== '') {
      const requestedSlug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
      const checkSlug = await this.prisma.invitation.findUnique({ where: { slug: requestedSlug } });
      if (checkSlug && checkSlug.id !== existing.id) {
        throw new BadRequestException('SLUG_TAKEN');
      }
      slug = requestedSlug;
    }

    const payload: any = {
      slug,
      themeId: data.themeId ?? existing.themeId,
      animation: data.animation ?? existing.animation,
      title: data.title ?? existing.title,
      groom: data.groom ?? existing.groom,
      bride: data.bride ?? existing.bride,
      quote: data.quote ?? existing.quote,
      events: data.events ?? existing.events,
      banks: data.banks ?? existing.banks,
      gallery: data.gallery ?? existing.gallery,
      musicUrl: data.musicUrl ?? existing.musicUrl,
      backgroundUrl: data.backgroundUrl ?? existing.backgroundUrl,
      qrisImage: data.qrisImage ?? existing.qrisImage,
      design: data.design ?? existing.design,
      customDomain: data.customDomain ?? existing.customDomain,
      seoTitle: data.seoTitle ?? existing.seoTitle,
      seoDescription: data.seoDescription ?? existing.seoDescription,
      seoImage: data.seoImage ?? existing.seoImage,
    };

    const invitation = await this.prisma.invitation.update({
      where: { id: existing.id },
      data: payload
    });

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

