import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.digitalProduct.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.digitalProduct.findFirst({
      where: { id, tenantId }
    });
    if (!product) throw new NotFoundException('Produk tidak ditemukan');
    return product;
  }

  async create(tenantId: string, data: { title: string, description?: string, price: number, fileUrl: string, fileSize: number }) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isPremium: true, storageUsed: true }
    });

    if (!tenant) throw new NotFoundException('Tenant tidak ditemukan');

    // 500MB = 500 * 1024 * 1024 = 524288000 bytes
    // 5GB = 5 * 1024 * 1024 * 1024 = 5368709120 bytes
    const maxStorage = tenant.isPremium ? 5368709120 : 524288000;
    
    if (tenant.storageUsed + data.fileSize > maxStorage) {
      throw new BadRequestException(`Kapasitas penyimpanan Anda penuh. Silakan upgrade ke Premium untuk mendapatkan penyimpanan 5GB.`);
    }

    // Gunakan transaction untuk memastikan data produk dan storage tersimpan bersamaan
    return this.prisma.$transaction(async (tx) => {
      const newProduct = await tx.digitalProduct.create({
        data: {
          tenantId,
          title: data.title,
          description: data.description,
          price: data.price,
          fileUrl: data.fileUrl
        }
      });

      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          storageUsed: { increment: data.fileSize }
        }
      });

      return newProduct;
    });
  }

  async update(tenantId: string, id: string, data: { title?: string, description?: string, price?: number }) {
    const product = await this.findOne(tenantId, id);
    return this.prisma.digitalProduct.update({
      where: { id: product.id },
      data: {
        title: data.title,
        description: data.description,
        price: data.price
      }
    });
  }

  async remove(tenantId: string, id: string, fileSizeToFreeUp: number) {
    const product = await this.findOne(tenantId, id);
    
    return this.prisma.$transaction(async (tx) => {
      await tx.digitalProduct.delete({
        where: { id: product.id }
      });

      // Kembalikan sisa storage (pastikan tidak kurang dari 0)
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      const newStorageUsed = Math.max(0, (tenant?.storageUsed || 0) - fileSizeToFreeUp);

      await tx.tenant.update({
        where: { id: tenantId },
        data: { storageUsed: newStorageUsed }
      });
      
      return { success: true };
    });
  }
}
