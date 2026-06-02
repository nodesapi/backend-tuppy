import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // Merekam event (Bisa dipanggil oleh frontend publik)
  async trackEvent(data: { tenantId: string; type: 'PAGE_VIEW' | 'LINK_CLICK'; targetId?: string; userAgent?: string; ipHash?: string; referrer?: string; country?: string; city?: string; device?: string; os?: string; }) {
    return this.prisma.analyticsEvent.create({
      data: {
        tenantId: data.tenantId,
        type: data.type,
        targetId: data.targetId,
        userAgent: data.userAgent,
        ipHash: data.ipHash,
        referrer: data.referrer,
        country: data.country,
        city: data.city,
        device: data.device,
        os: data.os
      }
    });
  }

  // Mengambil ringkasan analitik untuk Dashboard
  async getSummary(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) {
      return {
        isPremiumActive: false,
        overview: { totalViews: 0, totalClicks: 0, ctr: 0, totalSales: 0, walletBalance: 0 },
        chartData: [],
        topLinks: [],
        demographics: null
      };
    }

    const tenantId = tenant.id;

    // Hitung Total Views & Clicks (semua waktu atau bisa dilimit)
    const totalViews = await this.prisma.analyticsEvent.count({
      where: { tenantId, type: 'PAGE_VIEW' }
    });

    const totalClicks = await this.prisma.analyticsEvent.count({
      where: { tenantId, type: 'LINK_CLICK' }
    });

    const ctr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : 0;

    // Hitung Total Penjualan & Saldo
    const totalSalesAggr = await this.prisma.order.aggregate({
      _sum: { grandTotal: true },
      where: { tenantId, status: 'DELIVERED' }
    });
    
    const totalSales = totalSalesAggr._sum.grandTotal || 0;
    const walletBalance = tenant.walletBalance || 0;

    // Ambil data Chart 7 Hari Terakhir
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    const chartData = await Promise.all(
      last7Days.map(async (date) => {
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const views = await this.prisma.analyticsEvent.count({
          where: {
            tenantId,
            type: 'PAGE_VIEW',
            createdAt: { gte: date, lt: nextDate }
          }
        });

        const clicks = await this.prisma.analyticsEvent.count({
          where: {
            tenantId,
            type: 'LINK_CLICK',
            createdAt: { gte: date, lt: nextDate }
          }
        });

        return {
          date: date.toISOString().split('T')[0], // YYYY-MM-DD
          views,
          clicks
        };
      })
    );

    // Ambil Top Links (Block yang paling banyak diklik)
    const clickEvents = await this.prisma.analyticsEvent.groupBy({
      by: ['targetId'],
      where: {
        tenantId,
        type: 'LINK_CLICK',
        targetId: { not: null }
      },
      _count: { targetId: true },
      orderBy: { _count: { targetId: 'desc' } },
      take: 5
    });

    const topLinks = await Promise.all(
      clickEvents.map(async (event) => {
        const block = await this.prisma.block.findUnique({ where: { id: event.targetId as string } });
        return {
          blockId: event.targetId,
          clicks: event._count.targetId,
          content: block?.content || null
        };
      })
    );

    const isPremiumActive = tenant.isPremium && tenant.premiumUntil && tenant.premiumUntil > new Date();
    
    let demographics = null;
    if (isPremiumActive) {
      // Aggregasi Negara
      const countryGroup = await this.prisma.analyticsEvent.groupBy({
        by: ['country'],
        where: { tenantId, country: { notIn: ['Unknown', ''] } },
        _count: { country: true },
        orderBy: { _count: { country: 'desc' } },
        take: 5
      });
      
      // Aggregasi Perangkat
      const deviceGroup = await this.prisma.analyticsEvent.groupBy({
        by: ['device'],
        where: { tenantId, device: { not: null } },
        _count: { device: true },
        orderBy: { _count: { device: 'desc' } }
      });
      
      // Aggregasi OS
      const osGroup = await this.prisma.analyticsEvent.groupBy({
        by: ['os'],
        where: { tenantId, os: { not: null } },
        _count: { os: true },
        orderBy: { _count: { os: 'desc' } }
      });

      demographics = {
        countries: countryGroup.map(g => ({ name: g.country, count: g._count.country })),
        devices: deviceGroup.map(g => ({ name: g.device, count: g._count.device })),
        os: osGroup.map(g => ({ name: g.os, count: g._count.os }))
      };
    }

    return {
      isPremiumActive,
      overview: { 
        totalViews, 
        totalClicks, 
        ctr: parseFloat(ctr as string),
        totalSales,
        walletBalance
      },
      chartData,
      topLinks,
      demographics
    };
  }
}
