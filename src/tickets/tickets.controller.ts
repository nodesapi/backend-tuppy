import { Controller, Post, Body } from '@nestjs/common';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // Public endpoint untuk laporan toko atau support user
  @Post()
  createTicket(
    @Body() body: { senderEmail: string; senderName: string; subject: string; message: string; type?: string; targetId?: string }
  ) {
    return this.ticketsService.createTicket(body);
  }
}
