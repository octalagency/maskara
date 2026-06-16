import {
  IsString,
  IsNumber,
  IsOptional,
  IsEmail,
  IsArray,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IntegrationType } from '@prisma/client';

export class CreateOrderDto {
  @ApiProperty({ example: 'ORD-12345' })
  @IsString()
  orderNumber: string;

  @ApiProperty({ example: 'shopify-order-id', required: false })
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiProperty({ example: 'রহিম আহমেদ' })
  @IsString()
  customerName: string;

  @ApiProperty({ example: '01712345678' })
  @IsString()
  customerPhone: string;

  @ApiProperty({ example: 'customer@email.com', required: false })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiProperty({ example: 2500 })
  @IsNumber()
  @Min(0)
  totalAmount: number;

  @ApiProperty({ example: 'BDT', required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  items?: Record<string, unknown>[];

  @ApiProperty({ required: false })
  @IsOptional()
  shippingAddress?: Record<string, unknown>;

  @ApiProperty({ example: 'COD', required: false })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ enum: IntegrationType, required: false })
  @IsOptional()
  @IsEnum(IntegrationType)
  source?: IntegrationType;

  @ApiProperty({ required: false })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
