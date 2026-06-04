/**
 * Nama Aplikasi : tupp.ly
 * Fungsi File   : File konfigurasi / logika bisnis untuk auth.controller.ts
 * Pembuat       : Wahyu Suhandi
 * GitHub        : https://github.com/nodesapi
 */

import { Controller, Request, Post, UseGuards, Body, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(AuthGuard('local'))
  @Post('login')
  @ApiOperation({ summary: 'Login user & dapatkan JWT Token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'tenant@tupp.ly' },
        password: { type: 'string', example: 'password123' },
      },
    },
  })
  async login(@Request() req: any) {
    return this.authService.login(req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('login/2fa')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Login dengan kode 2FA menggunakan tempToken' })
  async loginWith2fa(@Request() req: any, @Body('code') code: string) {
    // req.user contains the decoded payload from the tempToken
    if (req.user.isTwoFactorAuthenticated) {
      return { access_token: req.headers.authorization?.split(' ')[1] }; // Already authenticated
    }
    return this.authService.loginWith2fa(req.user, code);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/generate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate 2FA secret and QR code' })
  async generateTwoFactorSecret(@Request() req: any) {
    return this.authService.generateTwoFactorSecret(req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/turn-on')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Turn on 2FA' })
  async turnOnTwoFactorAuthentication(@Request() req: any, @Body('code') code: string) {
    await this.authService.turnOnTwoFactorAuthentication(req.user.sub, code);
    return { success: true, message: '2FA berhasil diaktifkan' };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/turn-off')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Turn off 2FA' })
  async turnOffTwoFactorAuthentication(@Request() req: any, @Body('code') code: string) {
    await this.authService.turnOffTwoFactorAuthentication(req.user.sub, code);
    return { success: true, message: '2FA berhasil dinonaktifkan' };
  }

  @Post('register')
  @ApiOperation({ summary: 'Daftar user baru' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'newuser@tupp.ly' },
        password: { type: 'string', example: 'password123' },
      },
    },
  })
  async register(@Body() body: any) {
    return this.authService.register(body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lihat profil user yang sedang login (Protected)' })
  getProfile(@Request() req: any) {
    return req.user;
  }
}
