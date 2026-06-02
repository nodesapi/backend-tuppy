import { PrismaService } from '../prisma/prisma.service';
export declare class AnalyticsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    trackEvent(data: {
        tenantId: string;
        type: 'PAGE_VIEW' | 'LINK_CLICK';
        targetId?: string;
        userAgent?: string;
        ipHash?: string;
        referrer?: string;
        country?: string;
        city?: string;
        device?: string;
        os?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        type: string;
        tenantId: string;
        targetId: string | null;
        userAgent: string | null;
        ipHash: string | null;
        referrer: string | null;
        country: string | null;
        city: string | null;
        device: string | null;
        os: string | null;
    }>;
    getSummary(userId: string): Promise<{
        isPremiumActive: boolean | null;
        overview: {
            totalViews: number;
            totalClicks: number;
            ctr: number;
            totalSales: number;
            walletBalance: number;
        };
        chartData: {
            date: string;
            views: number;
            clicks: number;
        }[];
        topLinks: {
            blockId: string | null;
            clicks: number;
            content: string | number | true | import("@prisma/client/runtime/client").JsonObject | import("@prisma/client/runtime/client").JsonArray | null;
        }[];
        demographics: {
            countries: {
                name: string | null;
                count: number;
            }[];
            devices: {
                name: string | null;
                count: number;
            }[];
            os: {
                name: string | null;
                count: number;
            }[];
        } | null;
    }>;
}
