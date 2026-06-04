/**
 * Nama Aplikasi : tupp.ly
 * Fungsi File   : File konfigurasi / logika bisnis untuk users.service.ts
 * Pembuat       : Wahyu Suhandi
 * GitHub        : https://github.com/nodesapi
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}



  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const defaultUsername = `user_${randomSuffix}`;

    return this.prisma.user.create({
      data: {
        ...data,
        tenant: {
          create: {
            username: defaultUsername,
            displayName: 'My Profile',
            notifMethod: 'EMAIL',
          }
        }
      },
    });
  }
  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }
}
