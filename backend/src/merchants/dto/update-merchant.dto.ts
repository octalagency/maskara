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
    description: 'Speech rate 0.75–1.35 (Google TTS speakingRate)',
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxCallRetries?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(5)
  retryIntervalMin?: number;
}
