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
}
