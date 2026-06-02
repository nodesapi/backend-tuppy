import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async getTenantByUserId(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
    });
    return tenant || null;
  }

  async updateTenant(userId: string, data: { username?: string; displayName?: string; bio?: string; avatarUrl?: string; bankName?: string; bankAccount?: string; bankAccountName?: string; waPhoneNumber?: string; notifMethod?: string }) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    
    // Check username uniqueness if provided
    if (data.username) {
      const existingUser = await this.prisma.tenant.findUnique({ where: { username: data.username } });
      if (existingUser && existingUser.userId !== userId) {
        throw new BadRequestException('Username is already taken');
      }
    }

    // Check premium status for WhatsApp notifications
    if (data.notifMethod && (data.notifMethod === 'WHATSAPP' || data.notifMethod === 'BOTH')) {
      if (tenant && !tenant.isPremium) {
        throw new BadRequestException('Fitur WhatsApp Gateway khusus untuk pengguna Premium.');
      }
    }

    if (tenant) {
      return this.prisma.tenant.update({
        where: { userId },
        data,
      });
    } else {
      if (!data.username || !data.displayName) {
         throw new BadRequestException('Username and Display Name are required for a new store.');
      }
      return this.prisma.tenant.create({
        data: {
          userId,
          username: data.username,
          displayName: data.displayName,
          bio: data.bio || '',
          avatarUrl: data.avatarUrl,
          bankName: data.bankName,
          bankAccount: data.bankAccount,
          bankAccountName: data.bankAccountName,
          waPhoneNumber: data.waPhoneNumber,
          notifMethod: data.notifMethod || 'EMAIL',
        },
      });
    }
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    let tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    
    if (!tenant) {
      // Create a default tenant if it doesn't exist so avatar upload works independently
      tenant = await this.prisma.tenant.create({
        data: {
          userId,
          username: `user_${userId.substring(0, 8)}`,
          displayName: `Profil ${userId.substring(0, 4)}`,
          avatarUrl,
        }
      });
      return tenant;
    }

    return this.prisma.tenant.update({
      where: { userId },
      data: { avatarUrl },
    });
  }
}
