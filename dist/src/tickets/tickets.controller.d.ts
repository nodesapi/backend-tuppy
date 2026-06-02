import { TicketsService } from './tickets.service';
export declare class TicketsController {
    private readonly ticketsService;
    constructor(ticketsService: TicketsService);
    createTicket(body: {
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
