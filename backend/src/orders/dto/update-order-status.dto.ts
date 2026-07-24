import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ShopIn Staff → Maskara may send VERIFIED / CANCELLED or confirmed / cancelled.
 */
export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'Order status or alias: VERIFIED|confirmed|CANCELLED|cancelled',
    example: 'VERIFIED',
  })
  @IsString()
  status: string;

  @ApiPropertyOptional({
    description: 'Optional source label (e.g. shopin_staff)',
  })
  @IsOptional()
  @IsString()
  source?: string;
}
