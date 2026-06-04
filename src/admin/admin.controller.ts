import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
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
}
