import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { InverterBrand } from '../../../common/enums';

export class InverterConnectorDto {
  @ApiProperty({
    enum: InverterBrand,
    description: 'The brand of the inverter',
  })
  @IsEnum(InverterBrand)
  brand: InverterBrand;

  @ApiPropertyOptional({
    description:
      'Victron VRM Personal Access Token. Required when brand is VICTRON.',
  })
  @ValidateIf((o: InverterConnectorDto) => o.brand === InverterBrand.VICTRON)
  @IsString()
  @MinLength(10)
  victronAccessToken?: string;

  @ApiPropertyOptional({
    description:
      'Growatt API token from ShinePhone app. Required when brand is GROWATT.',
  })
  @ValidateIf((o: InverterConnectorDto) => o.brand === InverterBrand.GROWATT)
  @IsString()
  @MinLength(10)
  growattApiToken?: string;

  @ApiPropertyOptional({
    description: 'Solarman account email. Required when brand is SUNSYNK.',
  })
  @ValidateIf((o: InverterConnectorDto) => o.brand === InverterBrand.SUNSYNK)
  @IsEmail()
  solarmanEmail?: string;

  @ApiPropertyOptional({
    description:
      'Solarman account password (plain text — backend handles MD5 hashing). Required when brand is SUNSYNK.',
  })
  @ValidateIf((o: InverterConnectorDto) => o.brand === InverterBrand.SUNSYNK)
  @IsString()
  @MinLength(6)
  solarmanPassword?: string;
}
