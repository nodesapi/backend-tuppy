import { Controller, Post, Body, Get, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // Public endpoint untuk laporan toko atau support user
  @Post()
  createTicket(
    @Body() body: { tenantId?: string; senderEmail: string; senderName: string; subject: string; message: string; type?: string; targetId?: string }
  ) {
    return this.ticketsService.createTicket(body);
  }

  // Khusus tenant: Ambil daftar riwayat tiket
  @UseGuards(AuthGuard('jwt'))
  @Get()
  getTickets(@Request() req: any) {
    return this.ticketsService.getTicketsByUserId(req.user.id);
  }

  // Khusus tenant: Ambil detail tiket & pesan chat
  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  getTicketDetail(@Request() req: any, @Param('id') id: string) {
    return this.ticketsService.getTicketDetail(req.user.id, id);
  }

  // Khusus tenant: Membalas chat tiket
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/messages')
  replyTicket(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { message: string }
  ) {
    if (!body.message) throw new BadRequestException('Pesan tidak boleh kosong');
    return this.ticketsService.replyTicket(req.user.id, id, body.message);
  }
}
