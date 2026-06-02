import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateLeadStatusDto {
  @IsIn(['NEW', 'FOLLOW_UP', 'CONFIRMED', 'COMPLETED', 'CANCELLED'])
  status: string;

  @IsOptional()
  @IsString()
  internalNote?: string;
}
