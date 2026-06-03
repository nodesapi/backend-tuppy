import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, NotFoundException } from '@nestjs/common';
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
  async findAll(@Request() req: any) {
    const tenantId = await this.getTenantId(req.user.id);
    return this.productsService.findAll(tenantId);
  }

  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    const tenantId = await this.getTenantId(req.user.id);
    return this.productsService.findOne(tenantId, id);
  }

  @Post()
  async create(@Request() req: any, @Body() body: any) {
    const tenantId = await this.getTenantId(req.user.id);
    const { title, description, price, fileUrl, fileSize } = body;
    return this.productsService.create(tenantId, {
      title,
      description,
      price: Number(price),
      fileUrl,
      fileSize: Number(fileSize)
    });
  }

  @Put(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const tenantId = await this.getTenantId(req.user.id);
    const { title, description, price } = body;
    return this.productsService.update(tenantId, id, {
      title,
      description,
      price: price ? Number(price) : undefined
    });
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string, @Body('fileSize') fileSize: number) {
    const tenantId = await this.getTenantId(req.user.id);
    return this.productsService.remove(tenantId, id, Number(fileSize || 0));
  }
}
