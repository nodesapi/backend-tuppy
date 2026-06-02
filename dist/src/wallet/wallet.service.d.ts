import { PrismaService } from '../prisma/prisma.service';
export declare class WalletService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getMyWallet(userId: string): Promise<{
        balance: number;
        transactions: {
            id: string;
            createdAt: Date;
            amount: number;
            status: string;
            description: string;
            type: string;
            tenantId: string;
            referenceId: string | null;
        }[];
    }>;
    withdraw(userId: string, amount: number): Promise<{
        success: boolean;
        transaction: {
            id: string;
            createdAt: Date;
            amount: number;
            status: string;
            description: string;
            type: string;
            tenantId: string;
            referenceId: string | null;
        };
    }>;
}
