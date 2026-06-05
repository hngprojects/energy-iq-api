import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { GeneratorFuelType } from '../../../common/enums/generator';

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

  @ApiProperty({ example: 'https://energyiq.com/myprofile.jpg' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  profileUrl?: string;

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

  @ApiProperty({ example: 'English' })
  @IsString()
  @MinLength(1)
  @MaxLength(25)
  @IsOptional()
  aiLanguage?: string;

  @ApiProperty({ example: 1700 })
  @IsNumber()
  @IsOptional()
  customFuelPriceNaira?: number;

  @ApiProperty({ example: 1500 })
  @IsNumber()
  @IsOptional()
  generatorRatedPowerKw?: number;

  @ApiProperty({ example: 'PMS' })
  @IsEnum(GeneratorFuelType)
  generatorFuelType?: string;

  @ApiProperty({ example: 1500 })
  @IsNumber()
  @IsOptional()
  generatorAverageDailyRuntimeHours?: number;
}
