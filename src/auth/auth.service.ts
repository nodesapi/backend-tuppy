/**
 * Nama Aplikasi : tupp.ly
 * Fungsi File   : File konfigurasi / logika bisnis untuk auth.service.ts
 * Pembuat       : Wahyu Suhandi
 * GitHub        : https://github.com/nodesapi
 */

import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Email belum terdaftar');
    }
    const isPasswordValid = await bcrypt.compare(pass, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Password salah');
    }
    const { password, ...result } = user;
    return result;
  }

  async login(user: any) {
    if (user.isTwoFactorEnabled) {
      const payload = {
        email: user.email,
        sub: user.id,
        role: user.role,
        isTwoFactorAuthenticated: false,
      };
      return {
        requires2fa: true,
        tempToken: this.jwtService.sign(payload, { expiresIn: '5m' }),
      };
    }

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      isTwoFactorAuthenticated: true,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async loginWith2fa(payload: any, code: string) {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.twoFactorSecret) {
      throw new UnauthorizedException('2FA belum disetup');
    }

    const isCodeValid = this.verifyTwoFactorCode(code, user.twoFactorSecret);
    if (!isCodeValid) {
      throw new UnauthorizedException('Kode 2FA tidak valid');
    }

    const tokenPayload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      isTwoFactorAuthenticated: true,
    };
    return {
      access_token: this.jwtService.sign(tokenPayload),
    };
  }

  async generateTwoFactorSecret(user: any) {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'Tupply', secret);

    await this.usersService.update(user.id, { twoFactorSecret: secret });

    return {
      secret,
      qrCodeDataUrl: await qrcode.toDataURL(otpauthUrl),
    };
  }

  verifyTwoFactorCode(code: string, secret: string) {
    return authenticator.verify({
      token: code,
      secret: secret,
    });
  }

  async turnOnTwoFactorAuthentication(userId: string, code: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA belum disetup');
    }

    const isCodeValid = this.verifyTwoFactorCode(code, user.twoFactorSecret);
    if (!isCodeValid) {
      throw new BadRequestException('Kode 2FA tidak valid');
    }

    await this.usersService.update(userId, { isTwoFactorEnabled: true });
  }

  async turnOffTwoFactorAuthentication(userId: string, code: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA belum disetup');
    }

    const isCodeValid = this.verifyTwoFactorCode(code, user.twoFactorSecret);
    if (!isCodeValid) {
      throw new BadRequestException('Kode 2FA tidak valid');
    }

    await this.usersService.update(userId, {
      isTwoFactorEnabled: false,
      twoFactorSecret: null,
    });
  }

  async register(data: any) {
    const existingUser = await this.usersService.findByEmail(data.email);
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await this.usersService.create({
      ...data,
      password: hashedPassword,
    });

    const { password, ...result } = user;
    return result;
  }
}
