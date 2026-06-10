import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // PUBLIC: Guest checkout (tidak perlu login)
  @Post('checkout')
  checkout(@Body() dto: CreateOrderDto) {
    return this.ordersService.checkout(dto);
  }

  // PUBLIC: Lacak pesanan (Guest Tracking)
  @Get('track/:orderNumber')
  trackOrder(
    @Param('orderNumber') orderNumber: string,
    @Query('phone') phone: string,
  ) {
    return this.ordersService.trackOrder(orderNumber, phone);
  }

  // PUBLIC: Konfirmasi Pesanan Diterima / Komplain
  @Post('track/:orderNumber/confirm')
  confirmOrderGuest(
    @Param('orderNumber') orderNumber: string,
    @Body('phone') phone: string,
    @Body('isComplain') isComplain: boolean,
    @Body('videoUrl') videoUrl?: string,
  ) {
    if (!phone) throw new BadRequestException('Nomor WhatsApp wajib diisi');
    return this.ordersService.confirmOrderGuest(
      orderNumber,
      phone,
      isComplain,
      videoUrl,
    );
  }

  // PUBLIC: Get Payment Channels for a Store
  @Get('channels/:tenantUsername')
  getChannels(@Param('tenantUsername') tenantUsername: string) {
    return this.ordersService.getPaymentChannels(tenantUsername);
  }

  // PUBLIC: Get Raw Invoice for Tracking
  @Get('track/:orderNumber/invoice')
  getOrderInvoice(@Param('orderNumber') orderNumber: string) {
    return this.ordersService.getOrderInvoice(orderNumber);
  }

  // PUBLIC: Download file produk digital
  @Get('download')
  downloadDigitalFile(@Query('token') token: string) {
    return this.ordersService.downloadFile(token);
  }

  // PUBLIC: Upload Bukti Pembayaran Manual
  @Post(':orderNumber/payment-proof')
  uploadPaymentProof(
    @Param('orderNumber') orderNumber: string,
    @Body('proofUrl') proofUrl: string,
  ) {
    if (!proofUrl) {
      throw new BadRequestException('proofUrl is required');
    }
    return this.ordersService.uploadPaymentProof(orderNumber, proofUrl);
  }

  // PRIVATE: List semua order masuk (dashboard)
  @UseGuards(AuthGuard('jwt'))
  @Get('mine')
  getMyOrders(@Request() req: any, @Query('status') status?: string) {
    return this.ordersService.getMyOrders(req.user.id, status);
  }

  // PRIVATE: Jumlah order PENDING untuk badge sidebar
  @UseGuards(AuthGuard('jwt'))
  @Get('pending-count')
  getPendingCount(@Request() req: any) {
    return this.ordersService.getPendingCount(req.user.id);
  }

  // ADMIN: List semua order lintas tenant (hanya untuk role ADMIN)
  @UseGuards(AuthGuard('jwt'))
  @Get('admin/all')
  getAllOrders(@Request() req: any, @Query('status') status?: string) {
    if (req.user.role !== 'ADMIN') {
      throw new BadRequestException('Akses ditolak. Hanya untuk Admin.');
    }
    return this.ordersService.getAllOrders(status);
  }

  // PRIVATE: Detail satu order
  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  getOrderDetail(@Param('id') id: string, @Request() req: any) {
    return this.ordersService.getOrderDetail(id, req.user.id);
  }

  // PRIVATE: Update status + catatan internal
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/status')
  updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Request() req: any,
  ) {
    return this.ordersService.updateOrderStatus(id, dto, req.user.id);
  }
}
