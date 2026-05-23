import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserPersonalSettingsDto {
  @ApiProperty({ example: 'John' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  firstName?: string;

  @ApiProperty({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  lastName?: string;

  @ApiProperty({ example: 'Test Business' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  businessName?: string;

  @ApiProperty({ example: 'Clothings' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  businessType?: string;

  @ApiProperty({ example: 'Rivers' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  state?: string;

  @ApiProperty({ example: 'Port Harcourt' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city?: string;
}
