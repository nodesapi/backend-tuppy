import { Module } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [ShippingService, PrismaService],
  controllers: [ShippingController],
  exports: [ShippingService],
})
export class ShippingModule {}
