import { Controller, Get, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { PagesService } from './pages.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('my/:slug')
  getMyPage(@Request() req: any, @Param('slug') slug: string) {
    return this.pagesService.getMyPage(req.user.id, slug);
  }

  @Get('public/:slug')
  getPublicPage(@Param('slug') slug: string) {
    return this.pagesService.getPublicPage(slug);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('my/:slug')
  updateMyPage(@Request() req: any, @Param('slug') slug: string, @Body() data: any) {
    return this.pagesService.updateMyPage(req.user.id, slug, data);
  }
}
