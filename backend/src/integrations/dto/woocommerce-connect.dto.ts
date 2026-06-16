import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WooCommerceConnectDto {
  @ApiProperty({ example: 'https://mystore.com' })
  @IsString()
  storeUrl: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  storeName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  wcVersion?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pluginVersion?: string;
}
