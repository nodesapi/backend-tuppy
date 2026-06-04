import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request, Query, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
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

  // PUBLIC: Upload Bukti Pembayaran Manual
  @Post(':orderNumber/payment-proof')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './public/uploads/proofs',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        cb(null, `${randomName}${extname(file.originalname)}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
        return cb(new BadRequestException('Only image files are allowed!'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 3 * 1024 * 1024 } // 3MB
  }))
  async uploadPaymentProof(
    @Param('orderNumber') orderNumber: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const proofUrl = `/uploads/proofs/${file.filename}`;
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
