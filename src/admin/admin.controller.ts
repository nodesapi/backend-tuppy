import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard('jwt'))
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboardStats(@Request() req: any) {
    return this.adminService.getDashboardStats(req.user.id);
  }

  @Get('transactions')
  getAllTransactions(@Request() req: any) {
    return this.adminService.getAllTransactions(req.user.id);
  }

  @Get('subscriptions')
  getAllSubscriptions(@Request() req: any) {
    return this.adminService.getAllSubscriptions(req.user.id);
  }

  @Get('tenants')
  getAllTenants(@Request() req: any) {
    return this.adminService.getAllTenants(req.user.id);
  }

  @Patch('tenants/:id/suspend')
  suspendTenant(
    @Request() req: any,
    @Param('id') tenantId: string,
    @Body() body: { isSuspended: boolean; reason?: string }
  ) {
    return this.adminService.suspendTenant(req.user.id, tenantId, body.isSuspended, body.reason);
  }

  @Get('tickets')
  getAllTickets(@Request() req: any) {
    return this.adminService.getAllTickets(req.user.id);
  }

  @Patch('tickets/:id/status')
  updateTicketStatus(
    @Request() req: any,
    @Param('id') ticketId: string,
    @Body('status') status: string
  ) {
    return this.adminService.updateTicketStatus(req.user.id, ticketId, status);
  }

  @Get('config')
  getGlobalConfig() {
    // Accessible by any admin (or even public if moved to app, but this is admin scoped for now)
    return this.adminService.getGlobalConfig();
  }

  @Patch('config')
  updateGlobalConfig(
    @Request() req: any,
    @Body() body: Record<string, string>
  ) {
    return this.adminService.updateGlobalConfig(req.user.id, body);
  }

  @Get('withdrawals')
  getWithdrawalRequests(@Request() req: any) {
    return this.adminService.getWithdrawalRequests(req.user.id);
  }

  @Patch('withdrawals/:id/process')
  processWithdrawalRequest(
    @Request() req: any,
    @Param('id') requestId: string,
    @Body('proofUrl') proofUrl: string
  ) {
    return this.adminService.processWithdrawalRequest(req.user.id, requestId, proofUrl);
  }

  @Get('kyc')
  getKycRequests(@Request() req: any) {
    return this.adminService.getKycRequests(req.user.id);
  }

  @Patch('kyc/:tenantId')
  updateKycStatus(
    @Request() req: any,
    @Param('tenantId') tenantId: string,
    @Body() body: { status: string; reason?: string }
  ) {
    return this.adminService.updateKycStatus(req.user.id, tenantId, body.status, body.reason);
  }

  @Post('invitations/music')
  addMusicPreset(
    @Request() req: any,
    @Body() data: { name: string; url: string }
  ) {
    return this.adminService.addMusicPreset(req.user.id, data);
  }

  @Get('invitations/music')
  getMusicPresets(@Request() req: any) {
    return this.adminService.getMusicPresets(req.user.id);
  }

  @Delete('invitations/music/:id')
  deleteMusicPreset(
    @Request() req: any,
    @Param('id') id: string
  ) {
    return this.adminService.deleteMusicPreset(req.user.id, id);
  }

  @Post('invitations/background')
  addBackgroundPreset(
    @Request() req: any,
    @Body() data: { name: string; url: string }
  ) {
    return this.adminService.addBackgroundPreset(req.user.id, data);
  }

  @Get('invitations/background')
  getBackgroundPresets(@Request() req: any) {
    return this.adminService.getBackgroundPresets(req.user.id);
  }

  @Delete('invitations/background/:id')
  deleteBackgroundPreset(
    @Request() req: any,
    @Param('id') id: string
  ) {
    return this.adminService.deleteBackgroundPreset(req.user.id, id);
  }
}

