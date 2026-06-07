import { Injectable, NotFoundException } from '@nestjs/common';
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
    if (!slug) {
      // Generate slug based on groom and bride nicknames
      const groomName = data.groom?.nickname || 'romeo';
      const brideName = data.bride?.nickname || 'juliet';
      slug = `${groomName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${brideName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      
      // Ensure uniqueness
      const checkSlug = await this.prisma.invitation.findUnique({ where: { slug } });
      if (checkSlug) {
        slug = `${slug}-${Math.floor(Math.random() * 10000)}`;
      }
    }

    const payload = {
      tenantId: tenant.id,
      slug,
      themeId: data.themeId || 'theme-classic',
      title: data.title || `Pernikahan ${data.groom?.nickname || 'Romeo'} & ${data.bride?.nickname || 'Juliet'}`,
      groom: data.groom || {},
      bride: data.bride || {},
      events: data.events || {},
      banks: data.banks || [],
      gallery: data.gallery || [],
      musicUrl: data.musicUrl || '',
      qrisImage: data.qrisImage || '',
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
          data: data.guests.map(g => ({
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
}
