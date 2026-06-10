import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { EmailModule } from '../email/email.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ShippingModule } from '../shipping/shipping.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [PrismaModule, WhatsappModule, EmailModule, SubscriptionsModule, ShippingModule, ChatModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
