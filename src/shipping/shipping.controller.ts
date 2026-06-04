import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ShippingService } from './shipping.service';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get('provinces')
  async getProvinces() {
    const data = await this.shippingService.getProvinces();
    return { success: true, data };
  }

  @Get('cities')
  async getCities(@Query('province') provinceId: string) {
    const data = await this.shippingService.getCities(provinceId);
    return { success: true, data };
  }

  @Post('cost')
  @HttpCode(HttpStatus.OK)
  async getCost(
    @Body('origin') origin: string,
    @Body('destination') destination: string,
    @Body('weight') weight: number,
    @Body('courier') courier: string,
  ) {
    if (!origin || !destination || !weight || !courier) {
      return { success: false, message: 'Missing required fields: origin, destination, weight, courier' };
    }
    const data = await this.shippingService.getCost(origin, destination, weight, courier);
    return { success: true, data };
  }

  @Post('track')
  @HttpCode(HttpStatus.OK)
  async trackWaybill(
    @Body('waybill') waybill: string,
    @Body('courier') courier: string,
  ) {
    if (!waybill || !courier) {
      return { success: false, message: 'Missing required fields: waybill, courier' };
    }
    const data = await this.shippingService.trackWaybill(waybill, courier);
    return { success: true, data };
  }
}
