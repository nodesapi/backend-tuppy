import { PrismaService } from '../prisma/prisma.service';
export declare class TicketsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createTicket(data: {
        senderEmail: string;
        senderName: string;
        subject: string;
        message: string;
        type?: string;
        targetId?: string;
    }): Promise<{
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
