import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type InvitationMediaEntry = {
  normalizedPath: string;
  originalUrl: string;
};

@Injectable()
export class InvitationsService {
  constructor(private prisma: PrismaService) {}

  private getEffectiveInvitationState(invitation: any) {
    const now = new Date();
    const activeUntil = invitation?.activeUntil ? new Date(invitation.activeUntil) : null;
    const isExpired = Boolean(activeUntil && activeUntil.getTime() < now.getTime());
    const isActive = Boolean(invitation?.isActive) && !isExpired;
    const isPremium = Boolean(invitation?.isPremium) && !isExpired;

    return {
      ...invitation,
      isActive,
      isPremium,
      accessStatus: isActive
        ? (isPremium ? 'ACTIVE_PAID' : 'ACTIVE_TRIAL')
        : (isExpired ? 'EXPIRED' : 'SUSPENDED'),
    };
  }

  private async getTenantByUserId(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId }
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  private asObject(value: any): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  private extractMediaUrls(invitation: any): string[] {
    const urls = new Set<string>();
    const pushUrl = (value: any) => {
      if (typeof value === 'string' && value.trim()) {
        urls.add(value.trim());
      }
    };

    pushUrl(invitation?.backgroundUrl);
    pushUrl(invitation?.musicUrl);
    pushUrl(invitation?.seoImage);
    pushUrl(invitation?.qrisImage);

    const groom = this.asObject(invitation?.groom);
    const bride = this.asObject(invitation?.bride);

    pushUrl(groom.photo);
    pushUrl(bride.photo);

    const gallery = Array.isArray(invitation?.gallery) ? invitation.gallery : [];
    for (const item of gallery) {
      if (typeof item === 'string') {
        pushUrl(item);
        continue;
      }

      const mediaItem = this.asObject(item);
      pushUrl(mediaItem.url);
      pushUrl(mediaItem.src);
      pushUrl(mediaItem.image);
    }

    return Array.from(urls);
  }

  private normalizeInvitationMediaPath(url: string, tenantId: string): string | null {
    if (!url || typeof url !== 'string') return null;

    let pathname = url.trim();

    try {
      if (/^https?:\/\//i.test(pathname)) {
        pathname = new URL(pathname).pathname;
      }
    } catch {
      return null;
    }

    if (pathname.includes('/uploads/undangan/')) {
      pathname = pathname.replace('/uploads/undangan/', '/images/undangan/');
    }

    if (!pathname.startsWith('/images/undangan/')) {
      return null;
    }

    if (!pathname.startsWith(`/images/undangan/${tenantId}/`)) {
      return null;
    }

    return pathname;
  }

  private collectOwnUploadMediaEntries(invitation: any, tenantId: string): InvitationMediaEntry[] {
    const entries = new Map<string, InvitationMediaEntry>();

    for (const rawUrl of this.extractMediaUrls(invitation)) {
      const normalizedPath = this.normalizeInvitationMediaPath(rawUrl, tenantId);
      if (!normalizedPath) continue;

      if (!entries.has(normalizedPath)) {
        entries.set(normalizedPath, {
          normalizedPath,
          originalUrl: rawUrl,
        });
      }
    }

    return Array.from(entries.values());
  }

  private async collectMediaPathsUsedByOtherInvitations(tenantId: string, invitationId: string) {
    const otherInvitations = await this.prisma.invitation.findMany({
      where: {
        tenantId,
        id: { not: invitationId },
      },
      select: {
        groom: true,
        bride: true,
        gallery: true,
        musicUrl: true,
        backgroundUrl: true,
        qrisImage: true,
        seoImage: true,
      },
    });

    const usedPaths = new Set<string>();

    for (const invitation of otherInvitations) {
      const entries = this.collectOwnUploadMediaEntries(invitation, tenantId);
      for (const entry of entries) {
        usedPaths.add(entry.normalizedPath);
      }
    }

    return usedPaths;
  }

  private resolveCdnDeleteEndpoint(originalUrl: string) {
    if (/^https?:\/\//i.test(originalUrl)) {
      return new URL('/delete', originalUrl).toString();
    }

    const fallbackCdnUrl = process.env.CDN_APP_URL || process.env.PUBLIC_CDN_URL || 'http://localhost:4000';
    return new URL('/delete', fallbackCdnUrl).toString();
  }

  private async deleteMediaFromCdn(entries: InvitationMediaEntry[]) {
    const failed: string[] = [];
    let deleted = 0;

    for (const entry of entries) {
      try {
        const response = await fetch(this.resolveCdnDeleteEndpoint(entry.originalUrl), {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: entry.normalizedPath,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `HTTP ${response.status}`);
        }

        deleted += 1;
      } catch (error: any) {
        console.error(`Failed to delete invitation media ${entry.normalizedPath}:`, error?.message || error);
        failed.push(entry.normalizedPath);
      }
    }

    return { deleted, failed };
  }

  async getInvitations(userId: string) {
    const tenant = await this.getTenantByUserId(userId);

    const invitations = await this.prisma.invitation.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' }
    });

    return invitations.map((invitation) => this.getEffectiveInvitationState(invitation));
  }

  async getInvitationById(userId: string, id: string) {
    const tenant = await this.getTenantByUserId(userId);

    const invitation = await this.prisma.invitation.findFirst({
      where: { id, tenantId: tenant.id },
      include: { guests: true }
    });
    if (!invitation) throw new NotFoundException('Invitation not found');

    return this.getEffectiveInvitationState(invitation);
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
    const tenant = await this.getTenantByUserId(userId);

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

    // Pick a random music preset
    const musicPresets = await this.prisma.invitationMusic.findMany();
    const randomMusicUrl = musicPresets.length > 0 
      ? musicPresets[Math.floor(Math.random() * musicPresets.length)].url 
      : '';

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
      musicUrl: randomMusicUrl,
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
    const tenant = await this.getTenantByUserId(userId);

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
      customDomain: (data.customDomain ?? existing.customDomain) === '' ? null : (data.customDomain ?? existing.customDomain),
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

  async deleteInvitation(userId: string, id: string) {
    const tenant = await this.getTenantByUserId(userId);

    const invitation = await this.prisma.invitation.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        tenantId: true,
        slug: true,
        groom: true,
        bride: true,
        gallery: true,
        musicUrl: true,
        backgroundUrl: true,
        qrisImage: true,
        seoImage: true,
      },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');

    const ownUploadEntries = this.collectOwnUploadMediaEntries(invitation, tenant.id);
    const sharedPaths = await this.collectMediaPathsUsedByOtherInvitations(tenant.id, invitation.id);
    const deletableEntries = ownUploadEntries.filter((entry) => !sharedPaths.has(entry.normalizedPath));

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.deleteMany({
        where: { invitationId: invitation.id },
      });

      await tx.invitation.delete({
        where: { id: invitation.id },
      });
    });

    const cleanup = await this.deleteMediaFromCdn(deletableEntries);

    return {
      success: true,
      message: 'Undangan berhasil dihapus',
      deletedInvitationId: invitation.id,
      cleanup: {
        totalOwnUploadsFound: ownUploadEntries.length,
        deletedFromCdn: cleanup.deleted,
        skippedBecauseShared: ownUploadEntries.length - deletableEntries.length,
        failed: cleanup.failed,
      },
    };
  }

  async getPublicInvitation(slug: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { slug }
    });
    const effectiveInvitation = invitation ? this.getEffectiveInvitationState(invitation) : null;

    if (!effectiveInvitation || !effectiveInvitation.isActive) {
      throw new NotFoundException('Undangan tidak ditemukan atau sudah tidak aktif');
    }
    return effectiveInvitation;
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
        blockId: `invitation-${invitation.id}`,
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
        blockId: `invitation-${invitation.id}`,
        source: 'RSVP'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async upgradeWithWallet(userId: string, id: string, plan: string) {
    void userId;
    void id;
    void plan;
    throw new BadRequestException('Aktivasi undangan via saldo toko sudah dinonaktifkan. Gunakan checkout paket durasi 3, 6, atau 12 bulan.');
  }
}
