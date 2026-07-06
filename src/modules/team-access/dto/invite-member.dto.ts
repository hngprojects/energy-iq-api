import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, MaxLength, NotEquals } from 'class-validator';
import { InverterRole } from '../../../common/enums/inverter-role.enum';

export type AllowedRoles = Exclude<InverterRole, InverterRole.OWNER>;

export class InviteMemberDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ enum: InverterRole, example: InverterRole.VIEWER })
  @IsEnum(InverterRole)
  @NotEquals(InverterRole.OWNER)
  role: AllowedRoles;
}
