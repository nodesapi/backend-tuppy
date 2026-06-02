import { PrismaService } from '../prisma/prisma.service';
export declare class AdminService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private ensureAdmin;
    getDashboardStats(userId: string): Promise<{
        totalUsers: number;
        totalPremium: number;
        totalOrders: number;
        openTickets: number;
    }>;
    getAllTenants(userId: string): Promise<({
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
    suspendTenant(userId: string, tenantId: string, isSuspended: boolean, reason?: string): Promise<{
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
    getAllTickets(userId: string): Promise<{
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
    updateTicketStatus(userId: string, ticketId: string, status: string): Promise<{
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
