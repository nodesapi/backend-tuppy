import { Controller, Get, Post, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WhatsappService } from './whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(AuthGuard('jwt'))
@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly prisma: PrismaService,
  ) {}

  // --------------------------------------------------------------------------
  // TENANT ENDPOINTS (Untuk masing-masing penjual di Dashboard)
  // --------------------------------------------------------------------------

  @Get('status')
  async getStatus(@Req() req: any) {
    const userId = req.user.id;
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new ForbiddenException('Tenant not found');

    // Jika tenant membuka halaman ini, pastikan botnya nyala (lazy load trigger)
    if (tenant.notifMethod === 'WHATSAPP' || tenant.notifMethod === 'BOTH') {
       this.whatsappService.startBot(tenant.id);
    }
    
    return this.whatsappService.getSessionStatus(tenant.id);
  }

  @Post('logout')
  async logoutBot(@Req() req: any) {
    const userId = req.user.id;
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new ForbiddenException('Tenant not found');

    await this.whatsappService.logoutBot(tenant.id);
    return { success: true, message: 'WhatsApp disconnected' };
  }

  // --------------------------------------------------------------------------
  // ADMIN ENDPOINTS (Untuk Portal Super Admin)
  // --------------------------------------------------------------------------

  @Get('admin/status')
  async getAdminStatus(@Req() req: any) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    
    const config = await this.prisma.systemConfig.findUnique({ where: { key: 'WHATSAPP_SYSTEM_ENABLED' } });
    const isEnabled = config?.value === 'true';

    const sessionStatus = this.whatsappService.getSessionStatus('SYSTEM');

    return {
      isEnabled,
      ...sessionStatus
    };
  }

  @Post('admin/toggle')
  async toggleAdminStatus(@Req() req: any, @Body('enabled') enabled: boolean) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Admin only');

    await this.prisma.systemConfig.upsert({
      where: { key: 'WHATSAPP_SYSTEM_ENABLED' },
      update: { value: enabled ? 'true' : 'false' },
      create: { key: 'WHATSAPP_SYSTEM_ENABLED', value: enabled ? 'true' : 'false' }
    });

    if (enabled) {
      await this.whatsappService.startBot('SYSTEM');
    } else {
      await this.whatsappService.stopBot('SYSTEM');
    }

    return { success: true, enabled };
  }

  @Get('admin/logs')
  async getLogs(@Req() req: any) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    
    const logs = await this.prisma.whatsappLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200, // Limit for performance
      include: {
        tenant: {
          select: { displayName: true }
        }
      }
    });

    return logs;
  }
}
