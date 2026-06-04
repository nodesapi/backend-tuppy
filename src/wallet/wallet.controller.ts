import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('wallet')
@UseGuards(AuthGuard('jwt'))
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  getMyWallet(@Request() req: any) {
    return this.walletService.getMyWallet(req.user.id);
  }

  @Get('withdrawal-config')
  getWithdrawalConfig() {
    return this.walletService.getWithdrawalConfig();
  }

  @Post('withdraw')
  withdraw(@Request() req: any, @Body('amount') amount: number) {
    return this.walletService.withdraw(req.user.id, amount);
  }
}
