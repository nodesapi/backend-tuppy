import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('track/:orderNumber')
  createReview(
    @Param('orderNumber') orderNumber: string,
    @Body('phone') phone: string,
    @Body('rating') rating: number,
    @Body('comment') comment?: string,
  ) {
    return this.reviewsService.createReview(orderNumber, phone, rating, comment);
  }

  @Get('tenant/:tenantId')
  getTenantReviews(@Param('tenantId') tenantId: string) {
    return this.reviewsService.getTenantReviews(tenantId);
  }
}
