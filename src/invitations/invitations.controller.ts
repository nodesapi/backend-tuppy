import { Controller, Get, Post, Body, UseGuards, Request, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InvitationsService } from './invitations.service';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('mine')
  async getMyInvitation(@Request() req: any) {
    return this.invitationsService.getMyInvitation(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async saveInvitation(@Request() req: any, @Body() data: any) {
    return this.invitationsService.saveInvitation(req.user.id, data);
  }

  @Get('presets/music')
  async getMusicPresets() {
    return this.invitationsService.getMusicPresets();
  }

  @Get('presets/background')
  async getBackgroundPresets() {
    return this.invitationsService.getBackgroundPresets();
  }

  @Get('slug/:slug')
  async getPublicInvitation(@Param('slug') slug: string) {
    return this.invitationsService.getPublicInvitation(slug);
  }

  @Post('slug/:slug/rsvp')
  async submitRsvp(@Param('slug') slug: string, @Body() payload: any) {
    return this.invitationsService.submitRsvp(slug, payload);
  }

  @Get('slug/:slug/rsvp')
  async getRsvps(@Param('slug') slug: string) {
    return this.invitationsService.getRsvps(slug);
  }
}

