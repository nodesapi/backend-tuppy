import { AnalyticsService } from './analytics.service';
export declare class AnalyticsController {
    private readonly analyticsService;
    constructor(analyticsService: AnalyticsService);
    track(body: {
        tenantId: string;
        type: 'PAGE_VIEW' | 'LINK_CLICK';
        targetId?: string;
        referrer?: string;
    }, userAgent: string, ip: string): Promise<{
        success: boolean;
    }>;
    getSummary(req: any): Promise<{
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
