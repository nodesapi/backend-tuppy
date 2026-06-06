import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('Scraper')
@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Get('metadata')
  @ApiOperation({ summary: 'Scrape OpenGraph metadata from a URL' })
  @ApiQuery({ name: 'url', required: true, type: String })
  async scrapeMetadata(@Query('url') url: string) {
    if (!url) {
      throw new BadRequestException('URL parameter is required');
    }
    
    // Simple URL validation
    try {
      new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    return this.scraperService.scrapeUrl(url);
  }
}
