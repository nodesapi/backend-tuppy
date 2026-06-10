import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsOptional()
  @IsString()
  blockId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  productName: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsNumber()
  price: number;

  @IsNumber()
  quantity: number;

  @IsOptional()
  isDigital?: boolean;

  @IsOptional()
  @IsString()
  digitalFileId?: string;
}

export class CreateOrderDto {
  @IsString()
  tenantUsername: string;

  @IsString()
  customerName: string;

  @IsString()
  customerPhone: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  shippingAddress?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['DIRECT', 'SHOPEE', 'TOKOPEDIA', 'WHATSAPP', 'MARKETPLACE'])
  channel?: string;

  @IsOptional()
  @IsNumber()
  shippingCost?: number;

  @IsOptional()
  @IsString()
  courier?: string;

  @IsOptional()
  @IsString()
  destinationCityId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsOptional()
  @IsIn(['ONLINE', 'COD'])
  paymentMethod?: string;

  @IsOptional()
  @IsNumber()
  paymentChannelId?: number;
}

export class UpdateOrderStatusDto {
  @IsIn([
    'PENDING',
    'PAID',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED',
  ])
  status: string;

  @IsOptional()
  @IsString()
  internalNote?: string;

  @IsOptional()
  @IsString()
  awbNumber?: string;

  @IsOptional()
  @IsString()
  courier?: string;

  @IsOptional()
  @IsString()
  sellerPackingVideoUrl?: string;

  @IsOptional()
  @IsString()
  buyerUnboxingVideoUrl?: string;
}
