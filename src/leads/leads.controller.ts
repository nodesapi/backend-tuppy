import { Controller, Get, Patch, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LeadsService } from './leads.service';
import { UpdateLeadStatusDto } from '../orders/dto/update-lead.dto';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  // List semua lead (booking/RSVP) dengan filter opsional
  @UseGuards(AuthGuard('jwt'))
  @Get('mine')
  getMyLeads(
    @Request() req: any,
    @Query('source') source?: string,
    @Query('status') status?: string,
  ) {
    return this.leadsService.getMyLeads(req.user.id, source, status);
  }

  // Jumlah inbox (order PENDING + lead NEW) untuk badge sidebar
  @UseGuards(AuthGuard('jwt'))
  @Get('inbox-count')
  getInboxCount(@Request() req: any) {
    return this.leadsService.getInboxCount(req.user.id);
  }

  // Update status lead + catatan internal
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/status')
  updateLeadStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLeadStatusDto,
    @Request() req: any,
  ) {
    return this.leadsService.updateLeadStatus(id, dto, req.user.id);
  }
}
