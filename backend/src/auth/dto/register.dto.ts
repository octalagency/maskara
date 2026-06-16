import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'john@store.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'My Fashion Store' })
  @IsString()
  storeName: string;

  @ApiProperty({ example: 'আমার ফ্যাশন স্টোর', required: false })
  @IsOptional()
  @IsString()
  storeNameBangla?: string;

  @ApiProperty({ example: '+8801712345678' })
  @IsString()
  phone: string;
}
