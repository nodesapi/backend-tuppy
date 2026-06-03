import { PrismaService } from '../prisma/prisma.service';
import { UpdateLeadStatusDto } from '../orders/dto/update-lead.dto';
export declare class LeadsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getMyLeads(userId: string, source?: string, status?: string): Promise<{
        id: string;
        email: string | null;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        status: string;
        tenantId: string;
        blockId: string;
        phone: string | null;
        notes: string | null;
        internalNote: string | null;
        source: string;
        bookingDate: Date | null;
        bookingTime: string | null;
    }[]>;
    updateLeadStatus(leadId: string, dto: UpdateLeadStatusDto, userId: string): Promise<{
        id: string;
        email: string | null;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        status: string;
        tenantId: string;
        blockId: string;
        phone: string | null;
        notes: string | null;
        internalNote: string | null;
        source: string;
        bookingDate: Date | null;
        bookingTime: string | null;
    }>;
    getInboxCount(userId: string): Promise<{
        orders: number;
        leads: number;
        total: number;
    }>;
}
