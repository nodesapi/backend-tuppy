import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyWallet(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const transactions = await this.prisma.walletTransaction.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      balance: tenant.walletBalance,
      transactions,
    };
  }

  async getWithdrawalConfig() {
    const configs = await this.prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            'WITHDRAWAL_FEE_TIERS',
            'WITHDRAWAL_INTERBANK_FEE',
            'WITHDRAWAL_MAX_LIMIT',
            'WITHDRAWAL_DEFAULT_BANK',
          ],
        },
      },
    });

    // Default configs
    let feeTiers = [
      { max: 50000, fee: 500 },
      { max: 100000, fee: 1000 },
      { max: 500000, fee: 2500 },
      { max: 1000000, fee: 5000 },
      { max: 999999999, fee: 10000 },
    ];
    let interbankFee = 2500;
    let maxLimit = 2500000;
    let defaultBank = 'BCA'; // Bank pusat platform

    for (const c of configs) {
      if (c.key === 'WITHDRAWAL_FEE_TIERS') feeTiers = JSON.parse(c.value);
      if (c.key === 'WITHDRAWAL_INTERBANK_FEE')
        interbankFee = parseInt(c.value);
      if (c.key === 'WITHDRAWAL_MAX_LIMIT') maxLimit = parseInt(c.value);
      if (c.key === 'WITHDRAWAL_DEFAULT_BANK') defaultBank = c.value;
    }

    return { feeTiers, interbankFee, maxLimit, defaultBank };
  }

  async withdraw(userId: string, amount: number) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    if (!tenant.bankName || !tenant.bankAccount || !tenant.bankAccountName) {
      throw new BadRequestException(
        'Harap lengkapi data rekening pencairan di Pengaturan Profil terlebih dahulu.',
      );
    }

    if (tenant.walletBalance < amount) {
      throw new BadRequestException('Saldo tidak mencukupi');
    }

    const config = await this.getWithdrawalConfig();

    if (amount < 50000) {
      throw new BadRequestException('Minimal penarikan Rp 50.000');
    }

    // Check daily limit if they use Global Payhook (they don't have dedicated payhook)
    if (!tenant.payhookTenantId) {
      // Calculate total withdrawals today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todaysWithdrawals = await this.prisma.withdrawalRequest.aggregate({
        where: {
          tenantId: tenant.id,
          createdAt: { gte: today },
          status: { not: 'REJECTED' },
        },
        _sum: { amount: true },
      });

      const sumToday = (todaysWithdrawals._sum.amount || 0) + amount;
      if (sumToday > config.maxLimit) {
        throw new BadRequestException(
          `Limit penarikan harian (Rp ${config.maxLimit.toLocaleString('id-ID')}) tercapai. Upgrade ke Premium dan aktifkan Dedicated Payhook untuk limit tak terbatas.`,
        );
      }
    }

    // Calculate Fees
    let tieredFee = 0;
    for (const tier of config.feeTiers) {
      if (amount <= tier.max) {
        tieredFee = tier.fee;
        break;
      }
    }
    // If somehow amount > max defined tier, take the last one
    if (tieredFee === 0 && config.feeTiers.length > 0) {
      tieredFee = config.feeTiers[config.feeTiers.length - 1].fee;
    }

    let interbankFee = 0;
    if (tenant.bankName.toUpperCase() !== config.defaultBank.toUpperCase()) {
      interbankFee = config.interbankFee;
    }

    const totalFee = tieredFee + interbankFee;
    const netAmount = amount - totalFee;

    if (netAmount <= 0) {
      throw new BadRequestException(
        'Nominal penarikan terlalu kecil karena terpotong biaya transaksi.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Potong saldo
      await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          walletBalance: { decrement: amount },
        },
      });

      // Buat mutasi ledger
      const trx = await tx.walletTransaction.create({
        data: {
          tenantId: tenant.id,
          type: 'DEBIT',
          amount: amount,
          description: 'Permintaan Tarik Dana',
          status: 'PENDING',
        },
      });

      // Buat Request Withdrawal (Invoice Admin)
      const withdrawalReq = await tx.withdrawalRequest.create({
        data: {
          tenantId: tenant.id,
          amount: amount,
          fee: totalFee,
          netAmount: netAmount,
          bankName: tenant.bankName!,
          bankAccount: tenant.bankAccount!,
          bankAccountName: tenant.bankAccountName!,
          status: 'PENDING',
        },
      });

      // Update the wallet transaction reference to the withdrawal request
      await tx.walletTransaction.update({
        where: { id: trx.id },
        data: { referenceId: withdrawalReq.id },
      });

      return withdrawalReq;
    });

    return { success: true, withdrawal: result };
  }
}
