import { WalletService } from './wallet.service';
export declare class WalletController {
    private readonly walletService;
    constructor(walletService: WalletService);
    getMyWallet(req: any): Promise<{
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
    withdraw(req: any, amount: number): Promise<{
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
