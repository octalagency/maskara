import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMerchantDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  storeNameBangla?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customGreeting?: string;

  @ApiProperty({
    required: false,
    description: 'TTS voice id, e.g. azure:bn-BD-NabanitaNeural',
  })
  @IsOptional()
  @IsString()
  voiceId?: string;

  @ApiProperty({
    required: false,
    description: 'Speech rate 0.75–1.35 (default 0.95 for call-center pacing)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.75)
  @Max(1.35)
  speechRate?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  whatsappEnabled?: boolean;

  @ApiProperty({ required: false, description: 'Legacy lifetime dial cap (prefer lifetimeCallLimit)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(40)
  maxCallRetries?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(180)
  retryIntervalMin?: number;

  @ApiProperty({ required: false, description: 'Call window start as minutes from midnight (e.g. 580 = 09:40)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  callWindowStartMin?: number;

  @ApiProperty({ required: false, description: 'Call window end as minutes from midnight (e.g. 1320 = 22:00)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  callWindowEndMin?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  dailyCallLimit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(40)
  lifetimeCallLimit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  firstHourCallLimit?: number;
}
