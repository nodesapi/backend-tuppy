import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class StartConversationDto {
  @IsOptional()
  @IsString()
  tenantUsername?: string;

  @IsString()
  @MaxLength(120)
  customerName: string;

  @IsString()
  @MaxLength(30)
  customerPhone: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  customerEmail?: string;
}

export class BuyerChatMessageDto {
  @IsOptional()
  @IsString()
  guestToken?: string;

  @IsOptional()
  @IsString()
  orderNumber?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  attachmentName?: string;

  @IsOptional()
  @IsString()
  attachmentMimeType?: string;
}

export class SellerChatMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  attachmentName?: string;

  @IsOptional()
  @IsString()
  attachmentMimeType?: string;
}

export class SellerConversationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(['OPEN', 'PENDING_SELLER', 'PENDING_BUYER', 'CLOSED'])
  status?: string;

  @IsOptional()
  @IsString()
  @IsIn(['true', 'false'])
  onlyUnread?: string;
}
