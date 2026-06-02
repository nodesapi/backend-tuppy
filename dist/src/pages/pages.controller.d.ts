import { PagesService } from './pages.service';
export declare class PagesController {
    private readonly pagesService;
    constructor(pagesService: PagesService);
    getMyPage(req: any, slug: string): Promise<({
        blocks: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            order: number;
            content: import("@prisma/client/runtime/client").JsonValue;
            type: import("@prisma/client").$Enums.BlockType;
            pageId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string | null;
        tenantId: string;
        slug: string;
        themeConfig: import("@prisma/client/runtime/client").JsonValue | null;
        isPublished: boolean;
    }) | {
        id: string;
        tenantId: string;
        slug: string;
        title: string;
        themeConfig: {};
        blocks: never[];
    }>;
    getPublicPage(slug: string): Promise<({
        tenant: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            username: string;
            displayName: string;
            bio: string | null;
            avatarUrl: string | null;
            qrCodeUrl: string | null;
            customDomain: string | null;
            seoConfig: import("@prisma/client/runtime/client").JsonValue | null;
            isPremium: boolean;
            premiumUntil: Date | null;
            walletBalance: number;
            notifMethod: string;
            waPhoneNumber: string | null;
            pgProvider: string | null;
            pgApiKey: string | null;
            bankName: string | null;
            bankAccount: string | null;
            bankAccountName: string | null;
            isSuspended: boolean;
            suspendReason: string | null;
            userId: string;
        };
        blocks: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            order: number;
            content: import("@prisma/client/runtime/client").JsonValue;
            type: import("@prisma/client").$Enums.BlockType;
            pageId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string | null;
        tenantId: string;
        slug: string;
        themeConfig: import("@prisma/client/runtime/client").JsonValue | null;
        isPublished: boolean;
    }) | {
        suspended: boolean;
        reason: string;
    }>;
    updateMyPage(req: any, slug: string, data: any): Promise<({
        blocks: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            order: number;
            content: import("@prisma/client/runtime/client").JsonValue;
            type: import("@prisma/client").$Enums.BlockType;
            pageId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string | null;
        tenantId: string;
        slug: string;
        themeConfig: import("@prisma/client/runtime/client").JsonValue | null;
        isPublished: boolean;
    }) | {
        id: string;
        tenantId: string;
        slug: string;
        title: string;
        themeConfig: any;
        blocks: any;
    } | null>;
}
