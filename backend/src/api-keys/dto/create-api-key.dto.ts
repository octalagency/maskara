import { IsString, IsOptional, IsArray, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Production API Key' })
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  permissions?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
