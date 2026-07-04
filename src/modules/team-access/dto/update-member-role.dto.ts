import { ApiProperty } from '@nestjs/swagger';
import { InverterRole } from '../../../common/enums/inverter-role.enum';
import { IsEnum } from 'class-validator';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: InverterRole })
  @IsEnum(InverterRole)
  role: InverterRole;
}
