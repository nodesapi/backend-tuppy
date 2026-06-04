import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, NotFoundException, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/products')
@UseGuards(AuthGuard('jwt'))
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly prisma: PrismaService
  ) {}

  private async getTenantId(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant.id;
  }

  @Get()
  async findAll(@Request() req: any, @Query('isPhysical') isPhysical?: string) {
    const tenantId = await this.getTenantId(req.user.id);
    const parsedIsPhysical = isPhysical !== undefined ? isPhysical === 'true' : undefined;
    return this.productsService.findAll(tenantId, parsedIsPhysical);
  }

  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    const tenantId = await this.getTenantId(req.user.id);
    return this.productsService.findOne(tenantId, id);
  }

  @Post()
  async create(@Request() req: any, @Body() body: any) {
    const tenantId = await this.getTenantId(req.user.id);
    const { title, description, price, fileUrl, fileSize, imageUrl, images, isPhysical, weight, stock, sku } = body;
    return this.productsService.create(tenantId, {
      title,
      description,
      price: Number(price),
      fileUrl,
      imageUrl: images && images.length > 0 ? images[0] : imageUrl,
      images: images || [],
      fileSize: fileSize !== undefined ? Number(fileSize) : undefined,
      isPhysical: isPhysical === true || isPhysical === 'true',
      weight: weight !== undefined ? Number(weight) : undefined,
      stock: stock !== undefined ? Number(stock) : undefined,
      sku
    });
  }

  @Put(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const tenantId = await this.getTenantId(req.user.id);
    const { title, description, price, images, weight, stock, sku } = body;
    return this.productsService.update(tenantId, id, {
      title,
      description,
      price: price !== undefined ? Number(price) : undefined,
      imageUrl: images && images.length > 0 ? images[0] : undefined,
      images: images,
      weight: weight !== undefined ? Number(weight) : undefined,
      stock: stock !== undefined ? Number(stock) : undefined,
      sku
    });
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string, @Body('fileSize') fileSize: number) {
    const tenantId = await this.getTenantId(req.user.id);
    return this.productsService.remove(tenantId, id, Number(fileSize || 0));
  }
}
