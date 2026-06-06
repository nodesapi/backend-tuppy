import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  async scrapeUrl(url: string) {
    try {
      // Validate URL
      const parsedUrl = new URL(url);
      
      // Determine Platform
      let platform = 'unknown';
      if (parsedUrl.hostname.includes('shopee.')) {
        platform = 'shopee';
      } else if (parsedUrl.hostname.includes('tiktok.com')) {
        platform = 'tiktok';
      } else if (parsedUrl.hostname.includes('tokopedia.com')) {
        platform = 'tokopedia';
      }

      // Fetch HTML (With User-Agent to avoid basic bot blocks)
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 10000,
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Extract OpenGraph data
      let title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
      let image = $('meta[property="og:image"]').attr('content') || '';
      let description = $('meta[property="og:description"]').attr('content') || '';

      // Marketplace Specific Tweaks (because they sometimes don't use standard OG)
      if (platform === 'shopee') {
        // Shopee often renders via JS, so simple cheerio might not get everything,
        // but let's try our best with standard tags or specific classes if they exist.
        if (!title) title = $('.qaNIZv').text(); // Example class for title, though it changes often
      }

      // Cleanup strings
      title = title.trim();
      description = description.trim();

      // Ensure we have at least something
      if (!title && !image) {
         throw new Error('Could not find meaningful metadata. It might be blocked by bot protection.');
      }

      return {
        success: true,
        platform,
        title,
        image,
        description,
      };

    } catch (error) {
      this.logger.error(`Failed to scrape ${url}: ${error.message}`);
      
      // Return a structured failure instead of throwing HTTP error
      // so the frontend knows it must use manual fallback.
      return {
        success: false,
        platform: 'unknown',
        title: '',
        image: '',
        description: '',
        error: error.message
      };
    }
  }
}
