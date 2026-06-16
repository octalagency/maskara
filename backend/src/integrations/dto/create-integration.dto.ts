import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IntegrationType } from '@prisma/client';

export class CreateIntegrationDto {
  @ApiProperty({ enum: IntegrationType })
  @IsEnum(IntegrationType)
  type: IntegrationType;

  @ApiProperty({ example: 'My Shopify Store' })
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  webhookUrl?: string;
}
