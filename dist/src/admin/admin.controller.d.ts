import { AdminService } from './admin.service';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    getDashboardStats(req: any): Promise<{
        totalUsers: number;
        totalPremium: number;
        totalOrders: number;
        openTickets: number;
    }>;
    getAllTenants(req: any): Promise<({
        user: {
            email: string;
        };
        _count: {
            leads: number;
            orders: number;
        };
    } & {
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
    })[]>;
    suspendTenant(req: any, tenantId: string, body: {
        isSuspended: boolean;
        reason?: string;
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
    getAllTickets(req: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        type: string;
        message: string;
        targetId: string | null;
        subject: string;
        senderEmail: string;
        senderName: string;
    }[]>;
    updateTicketStatus(req: any, ticketId: string, status: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        type: string;
        message: string;
        targetId: string | null;
        subject: string;
        senderEmail: string;
        senderName: string;
    }>;
}
