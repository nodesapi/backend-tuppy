import { Controller, Get, Post, Delete, Body, UseGuards, Request, Param, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InvitationsService } from './invitations.service';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('mine')
  async getInvitations(@Request() req: any) {
    return this.invitationsService.getInvitations(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('check-slug')
  async checkSlug(@Body('slug') slug: string) {
    return this.invitationsService.checkSlug(slug);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async createInvitation(@Request() req: any, @Body() data: any) {
    return this.invitationsService.createInvitation(req.user.id, data);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  async getInvitationById(@Request() req: any, @Param('id') id: string) {
    return this.invitationsService.getInvitationById(req.user.id, id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id')
  async updateInvitation(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.invitationsService.updateInvitation(req.user.id, id, data);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async deleteInvitation(@Request() req: any, @Param('id') id: string) {
    return this.invitationsService.deleteInvitation(req.user.id, id);
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

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/upgrade-wallet')
  async upgradeWithWallet(@Request() req: any, @Param('id') id: string, @Body('plan') plan: string) {
    return this.invitationsService.upgradeWithWallet(req.user.id, id, plan);
  }
}
