import { TenantService } from './tenant.service';
export declare class TenantController {
    private readonly tenantService;
    constructor(tenantService: TenantService);
    getTenant(req: any): Promise<{
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
    } | null>;
    updateTenant(req: any, data: {
        username?: string;
        displayName?: string;
        bio?: string;
        avatarUrl?: string;
        bankName?: string;
        bankAccount?: string;
        bankAccountName?: string;
        waPhoneNumber?: string;
        notifMethod?: string;
    }): Promise<{
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
    }>;
    uploadAvatar(req: any, file: Express.Multer.File): Promise<{
        avatarUrl: string;
    }>;
}
