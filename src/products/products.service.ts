import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, isPhysical?: boolean) {
    const whereClause: any = { tenantId };
    if (isPhysical !== undefined) {
      whereClause.isPhysical = isPhysical;
    }
    return this.prisma.product.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });
    if (!product) throw new NotFoundException('Produk tidak ditemukan');
    return product;
  }

  async create(
    tenantId: string,
    data: {
      title: string;
      description?: string;
      price: number;
      fileUrl?: string;
      imageUrl?: string;
      images?: string[];
      fileSize?: number;
      isPhysical?: boolean;
      weight?: number;
      stock?: number;
      sku?: string;
    },
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isPremium: true, storageUsed: true },
    });

    if (!tenant) throw new NotFoundException('Tenant tidak ditemukan');

    if (!data.isPhysical && data.fileSize) {
      // 500MB = 500 * 1024 * 1024 = 524288000 bytes
      // 5GB = 5 * 1024 * 1024 * 1024 = 5368709120 bytes
      const maxStorage = tenant.isPremium ? 5368709120 : 524288000;

      if (tenant.storageUsed + data.fileSize > maxStorage) {
        throw new BadRequestException(
          `Kapasitas penyimpanan Anda penuh. Silakan upgrade ke Premium untuk mendapatkan penyimpanan 5GB.`,
        );
      }
    }

    // Gunakan transaction untuk memastikan data produk dan storage tersimpan bersamaan
    return this.prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          tenantId,
          title: data.title,
          description: data.description,
          price: data.price,
          fileUrl: data.fileUrl,
          imageUrl: data.imageUrl,
          images: data.images || [],
          isPhysical: data.isPhysical || false,
          weight: data.weight || null,
          stock: data.stock || null,
          sku: data.sku || null,
        },
      });

      if (!data.isPhysical && data.fileSize) {
        await tx.tenant.update({
          where: { id: tenantId },
          data: {
            storageUsed: { increment: data.fileSize },
          },
        });
      }

      return newProduct;
    });
  }

  async update(
    tenantId: string,
    id: string,
    data: {
      title?: string;
      description?: string;
      price?: number;
      imageUrl?: string;
      images?: string[];
      weight?: number;
      stock?: number;
      sku?: string;
    },
  ) {
    const product = await this.findOne(tenantId, id);

    // Check if any old images are removed, and delete them from CDN
    if (data.images && product.images && product.images.length > 0) {
      const removedImages = product.images.filter(
        (img: string) => !data.images!.includes(img),
      );
      if (removedImages.length > 0) {
        const cdnUrl = process.env.CDN_URL || 'http://localhost:4000';
        for (const url of removedImages) {
          fetch(`${cdnUrl}/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          }).catch((e) =>
            console.error('Failed to delete removed image from CDN:', e),
          );
        }
      }
    }

    return this.prisma.product.update({
      where: { id: product.id },
      data: {
        title: data.title,
        description: data.description,
        price: data.price,
        imageUrl: data.imageUrl,
        images: data.images,
        weight: data.weight,
        stock: data.stock,
        sku: data.sku,
      },
    });
  }

  async remove(tenantId: string, id: string, fileSizeToFreeUp: number) {
    const product = await this.findOne(tenantId, id);

    return this.prisma.$transaction(async (tx) => {
      // Send delete request to CDN first (best effort)
      if (
        product.imageUrl ||
        product.fileUrl ||
        (product.images && product.images.length > 0)
      ) {
        try {
          const cdnUrl = process.env.CDN_URL || 'http://localhost:4000';

          // Delete digital file or main image
          if (product.imageUrl || product.fileUrl) {
            await fetch(`${cdnUrl}/delete`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: product.imageUrl,
                r2Key: product.fileUrl,
              }),
            });
          }

          // Delete additional images
          if (product.images && product.images.length > 0) {
            for (const img of product.images) {
              if (img !== product.imageUrl) {
                await fetch(`${cdnUrl}/delete`, {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url: img }),
                });
              }
            }
          }
        } catch (e) {
          console.error('Failed to delete files from CDN:', e);
        }
      }

      await tx.product.delete({
        where: { id: product.id },
      });

      // Kembalikan sisa storage (pastikan tidak kurang dari 0)
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      const newStorageUsed = Math.max(
        0,
        (tenant?.storageUsed || 0) - fileSizeToFreeUp,
      );

      await tx.tenant.update({
        where: { id: tenantId },
        data: { storageUsed: newStorageUsed },
      });

      return { success: true };
    });
  }
}
