import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { promises as dns } from 'dns';
import { PayhookService } from '../subscriptions/payhook.service';

@Injectable()
export class TenantService {
  constructor(
    private prisma: PrismaService,
    private payhookService: PayhookService
  ) {}

  async getTenantByUserId(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
    });
    return tenant || null;
  }

  async updateTenant(userId: string, data: { username?: string; displayName?: string; bio?: string; avatarUrl?: string; bankName?: string; bankAccount?: string; bankAccountName?: string; waPhoneNumber?: string; notifMethod?: string; customDomain?: string; seoConfig?: any }) {
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

  async verifyDomain(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant || !tenant.customDomain) {
      throw new BadRequestException('Domain kustom belum dikonfigurasi. Silakan simpan pengaturan domain terlebih dahulu.');
    }

    try {
      // Coba resolve DNS record untuk domain tersebut
      await dns.resolve(tenant.customDomain);
      return { verified: true, message: 'Domain berhasil diverifikasi dan terhubung dengan server.' };
    } catch (error) {
      return { 
        verified: false, 
        message: 'Domain belum terhubung. Pastikan pengaturan DNS sudah benar dan tunggu masa propagasi (5 menit hingga 24 jam).' 
      };
    }
  }

  async uploadQrisToPayhook(userId: string, file: Express.Multer.File) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.isPremium) throw new BadRequestException('QRIS statis hanya untuk pengguna Premium.');
    if (!tenant.payhookTenantId) throw new BadRequestException('Akun Payhook belum diprovisioning. Harap hubungi admin.');

    // Upload to Payhook Server
    const payhookData = await this.payhookService.uploadQris(tenant.payhookTenantId, file);

    // Update the QRIS URL in Tupply Database
    if (payhookData && payhookData.qris_url) {
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { payhookQrisUrl: payhookData.qris_url }
      });
      return { success: true, qrisUrl: payhookData.qris_url };
    }

    throw new BadRequestException('Gagal mengunggah QRIS ke server Payhook.');
  }

  async provisionPaymentAccount(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
      include: { user: true }
    });

    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.isPremium) throw new BadRequestException('Hanya pengguna Premium yang dapat mengaktifkan fitur ini.');
    if (tenant.payhookTenantId) throw new BadRequestException('Akun Payhook sudah diaktifkan.');

    try {
      const payhookData = await this.payhookService.provisionPayhookAccount({
        name: tenant.displayName || tenant.username,
        email: tenant.user.email,
        phone: tenant.waPhoneNumber || undefined,
        password_hash: tenant.user.password,
        domain: tenant.customDomain || undefined,
      });

      if (payhookData && payhookData.tenant_id) {
        const updated = await this.prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            payhookTenantId: String(payhookData.tenant_id),
            payhookApiKey: payhookData.api_key_production
          }
        });
        return { success: true, message: 'Integrasi Payhook berhasil diaktifkan.', tenant: updated };
      }

      throw new Error('Data tidak lengkap dari Payhook');
    } catch (err: any) {
      console.error('Failed manual provisioning:', err.message);
      throw new BadRequestException('Gagal mengaktifkan integrasi Payhook. Pastikan server Payhook berjalan.');
    }
  }
}
