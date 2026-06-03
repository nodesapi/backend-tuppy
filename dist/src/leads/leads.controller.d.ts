import { LeadsService } from './leads.service';
import { UpdateLeadStatusDto } from '../orders/dto/update-lead.dto';
export declare class LeadsController {
    private readonly leadsService;
    constructor(leadsService: LeadsService);
    getMyLeads(req: any, source?: string, status?: string): Promise<{
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
    getInboxCount(req: any): Promise<{
        orders: number;
        leads: number;
        total: number;
    }>;
    updateLeadStatus(id: string, dto: UpdateLeadStatusDto, req: any): Promise<{
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
}
