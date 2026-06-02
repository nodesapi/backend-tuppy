import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyWallet(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const transactions = await this.prisma.walletTransaction.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' }
    });

    return {
      balance: tenant.walletBalance,
      transactions
    };
  }

  async withdraw(userId: string, amount: number) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    if (tenant.walletBalance < amount) {
      throw new BadRequestException('Saldo tidak mencukupi');
    }

    if (amount < 50000) {
      throw new BadRequestException('Minimal penarikan Rp 50.000');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Potong saldo
      await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          walletBalance: { decrement: amount }
        }
      });

      // Buat mutasi penarikan
      const trx = await tx.walletTransaction.create({
        data: {
          tenantId: tenant.id,
          type: 'DEBIT',
          amount: amount,
          description: 'Penarikan Dana (Withdraw)',
          status: 'PENDING' // Butuh approval admin
        }
      });

      return trx;
    });

    return { success: true, transaction: result };
  }
}
