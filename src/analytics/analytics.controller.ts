import { Controller, Get, Post, Body, UseGuards, Request, Headers, Ip } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AuthGuard } from '@nestjs/passport';

import * as UAParser from 'ua-parser-js';
import * as geoip from 'geoip-lite';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // Publik endpoint: ditembak oleh pengunjung toko (CORS enabled by default in main.ts)
  @Post('track')
  async track(
    @Body() body: { tenantId: string; type: 'PAGE_VIEW' | 'LINK_CLICK'; targetId?: string; referrer?: string },
    @Headers('user-agent') userAgent: string,
    @Ip() ip: string
  ) {
    // Basic IP Hashing (Optional: bisa pakai crypto hash)
    const ipHash = ip ? Buffer.from(ip).toString('base64') : 'unknown';

    // Parse Device and OS
    const parser = new (UAParser as any)(userAgent);
    const deviceType = parser.getDevice().type || 'Desktop';
    const osName = parser.getOS().name || 'Unknown';

    // Parse Location
    // Clean up IPv6 mapped IPv4 like ::ffff:127.0.0.1
    let cleanIp = ip;
    if (ip && ip.includes('::ffff:')) {
      cleanIp = ip.split('::ffff:')[1];
    }
    const geo = geoip.lookup(cleanIp);
    const country = geo ? geo.country : 'Unknown';
    const city = geo ? geo.city : 'Unknown';

    await this.analyticsService.trackEvent({
      ...body,
      userAgent,
      ipHash,
      device: deviceType,
      os: osName,
      country,
      city
    });
    
    return { success: true };
  }

  // Private endpoint: dashboard data
  @UseGuards(AuthGuard('jwt'))
  @Get('summary')
  getSummary(@Request() req: any) {
    return this.analyticsService.getSummary(req.user.id);
  }
}
