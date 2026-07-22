import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ShopInConnectDto {
  @ApiProperty({
    required: false,
    example: 'cmq2aqs1v0002kv4jnd7appya',
    description:
      'ShopIn shop id — optional if callbackUrl contains /webhooks/maskara/{shopId}',
  })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiProperty({ required: false, example: 'My Shopin Store' })
  @IsOptional()
  @IsString()
  shopName?: string;

  @ApiProperty({
    required: false,
    example: 'https://api.shopin.bd/api/v1/webhooks/maskara/cmq2aqs1v0002kv4jnd7appya',
    description: 'Override callback URL; default uses api.shopin.bd + shopId',
  })
  @IsOptional()
  @IsString()
  callbackUrl?: string;

  @ApiProperty({
    required: false,
    description: 'Shared webhook secret (same value saved in ShopIn Maskara settings)',
  })
  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @ApiProperty({ required: false, example: 'https://myshop.shopin.bd' })
  @IsOptional()
  @IsString()
  storeUrl?: string;
}
