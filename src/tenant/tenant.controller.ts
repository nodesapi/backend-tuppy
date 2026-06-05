import { Controller, Get, Patch, Post, Body, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { TenantService } from './tenant.service';

@Controller('tenant')
@UseGuards(AuthGuard('jwt'))
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  async getTenant(@Request() req: any) {
    const tenant = await this.tenantService.getTenantByUserId(req.user.id);
    return {
      ...tenant,
      meta: {
        escrowEnabled: process.env.ESCROW_ENABLED === 'true'
      }
    };
  }

  @Patch()
  updateTenant(@Request() req: any, @Body() data: { username?: string; displayName?: string; bio?: string; avatarUrl?: string; bankName?: string; bankAccount?: string; bankAccountName?: string; waPhoneNumber?: string; address?: string; province?: string; city?: string; district?: string; postalCode?: string; latitude?: number; longitude?: number; notifMethod?: string; customDomain?: string; seoConfig?: any; pgProvider?: string }) {
    return this.tenantService.updateTenant(req.user.id, data);
  }

  @Patch('password')
  changePassword(@Request() req: any, @Body() data: any) {
    return this.tenantService.changePassword(req.user.id, data.oldPassword, data.newPassword);
  }

  @Get('verify-domain')
  verifyDomain(@Request() req: any) {
    return this.tenantService.verifyDomain(req.user.id);
  }

  @Post('upload-avatar')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './public/uploads/avatars',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        cb(null, `${randomName}${extname(file.originalname)}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
        return cb(new BadRequestException('Only image files are allowed!'), false);
      }
      cb(null, true);
    },
    limits: {
      fileSize: 2 * 1024 * 1024 // 2MB
    }
  }))
  async uploadAvatar(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    
    // The ServeStaticModule serves from 'public', so the URL will be /uploads/avatars/filename
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    
    await this.tenantService.updateAvatar(req.user.id, avatarUrl);
    
    return { avatarUrl };
  }

  @Post('payment/qris')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
      if (!file.originalname.match(/\.(jpg|jpeg|png)$/i)) {
        return cb(new BadRequestException('Only JPG and PNG images are allowed for QRIS!'), false);
      }
      cb(null, true);
    }
  }))
  async uploadQris(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.tenantService.uploadQrisToPayhook(req.user.id, file);
  }

  @Post('payment/kyc')
  async uploadKyc(
    @Request() req: any,
    @Body() data: { ktpName: string; ktpNumber: string; ktpImageUrl: string }
  ) {
    if (!data.ktpName || !data.ktpNumber || !data.ktpImageUrl) {
      throw new BadRequestException('Nama KTP, NIK, dan URL Foto KTP wajib diisi');
    }
    
    return this.tenantService.submitKyc(req.user.id, data.ktpName, data.ktpNumber, data.ktpImageUrl);
  }

  @Post('payment/provision')
  async provisionPaymentAccount(@Request() req: any) {
    return this.tenantService.provisionPaymentAccount(req.user.id);
  }
}
