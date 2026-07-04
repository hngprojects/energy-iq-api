import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { InverterRole } from '../../../common/enums/inverter-role.enum';

export class InviteMemberDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ enum: InverterRole, example: InverterRole.VIEWER })
  @IsEnum(InverterRole)
  role: InverterRole;
}