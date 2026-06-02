import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyPage(userId: string, slug: string) {
    // Cari tenant milik user
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId }
    });

    if (!tenant) {
      // Untuk Super Admin, kembalikan dummy page agar builder tidak error/crash saat dibuka
      return {
        id: 'dummy',
        tenantId: 'dummy',
        slug,
        title: 'Dummy Page (Admin)',
        themeConfig: {},
        blocks: []
      };
    }

    // Coba cari halaman dengan slug tersebut
    let page = await this.prisma.page.findFirst({
      where: { tenantId: tenant.id, slug },
      include: { blocks: { orderBy: { order: 'asc' } } }
    });

    // Jika belum ada (misalnya slug 'index'), buat otomatis (upsert behavior)
    if (!page) {
      page = await this.prisma.page.create({
        data: {
          tenantId: tenant.id,
          slug,
          title: slug === 'index' ? 'Halaman Utama' : slug,
          themeConfig: {}, // Default empty config
        },
        include: { blocks: { orderBy: { order: 'asc' } } }
      });
    }

    return page;
  }

  async getPublicPage(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { username: slug }
    });
    
    if (!tenant) throw new NotFoundException('Store not found');

    // Jika akun ditangguhkan, kembalikan flag suspended
    if (tenant.isSuspended) {
      return { 
        suspended: true, 
        reason: tenant.suspendReason || 'Melanggar Ketentuan Layanan' 
      };
    }

    const page = await this.prisma.page.findFirst({
      where: { tenantId: tenant.id, slug: 'index' },
      include: { 
        blocks: { orderBy: { order: 'asc' } },
        tenant: true
      }
    });

    if (!page) throw new NotFoundException('Page not found');

    return page;
  }

  async updateMyPage(userId: string, slug: string, data: any) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId }
    });

    if (!tenant) {
      // Sama seperti getMyPage, cegah crash untuk Super Admin saat klik Save
      return {
        id: 'dummy',
        tenantId: 'dummy',
        slug,
        title: 'Dummy Page (Admin)',
        themeConfig: data.themeConfig || {},
        blocks: data.blocks || []
      };
    }

    let page = await this.prisma.page.findFirst({
      where: { tenantId: tenant.id, slug }
    });

    if (!page) {
      // Buat halaman baru jika belum ada
      page = await this.prisma.page.create({
        data: {
          tenantId: tenant.id,
          slug,
          title: slug === 'index' ? 'Halaman Utama' : slug,
          themeConfig: {}, 
        }
      });
    }

    // Gunakan transaction untuk memastikan integritas
    return this.prisma.$transaction(async (tx) => {
      // 1. Update theme config di Page
      const updatedPage = await tx.page.update({
        where: { id: page.id },
        data: {
          themeConfig: data.themeConfig !== undefined ? data.themeConfig : undefined
        }
      });

      // 2. Jika ada data blocks, replace semuanya
      if (data.blocks && Array.isArray(data.blocks)) {
        // Hapus blok lama
        await tx.block.deleteMany({
          where: { pageId: page.id }
        });

        // Insert blok baru dengan order yang sesuai
        const blocksData = data.blocks.map((b: any, index: number) => ({
          pageId: page.id,
          type: b.type,
          order: index,
          content: b.content || {}
        }));

        if (blocksData.length > 0) {
          await tx.block.createMany({
            data: blocksData
          });
        }
      }

      // 3. Ambil data terbaru untuk di-return
      return tx.page.findUnique({
        where: { id: page.id },
        include: { blocks: { orderBy: { order: 'asc' } } }
      });
    });
  }
}
