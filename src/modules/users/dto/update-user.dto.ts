import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ example: 'Jane' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  lastName: string;

  @ApiProperty({ example: '+23419052026' })
  @IsOptional()
  @IsPhoneNumber()
  @MinLength(1)
  @MaxLength(20)
  phoneNumber: string;
}
