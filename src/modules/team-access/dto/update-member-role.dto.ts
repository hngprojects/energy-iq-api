import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { InverterRole } from '../../../common/enums/inverter-role.enum';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: InverterRole })
  @IsEnum(InverterRole)
  role: InverterRole;
}
