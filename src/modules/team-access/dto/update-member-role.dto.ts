import { ApiProperty } from '@nestjs/swagger';
import { InverterRole } from '../../../common/enums/inverter-role.enum';
import { IsEnum, NotEquals } from 'class-validator';
import { type AllowedRoles } from './invite-member.dto';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: InverterRole, example: InverterRole.VIEWER })
  @IsEnum(InverterRole)
  @NotEquals(InverterRole.OWNER)
  role: AllowedRoles;
}
