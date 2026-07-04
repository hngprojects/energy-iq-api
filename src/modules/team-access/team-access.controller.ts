import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InverterRoleGuard } from '../../common/guards/inverter-role.guard';
import { InverterRoles } from '../../common/decorators/inverter-roles.decorator';
import { InverterRole } from '../../common/enums/inverter-role.enum';

@ApiBearerAuth()
@UseGuards(InverterRoleGuard)
@Controller('/inverters/:inverterId/team-access')
export class TeamAccessController {
  constructor() {}

  @InverterRoles(InverterRole.ADMIN)
  @Post('invite')
  @ApiOperation({ summary: 'invite member to view inverter' })
  @HttpCode(HttpStatus.CREATED)
  inviteMember() {}

  @InverterRoles(InverterRole.ADMIN)
  @Get('')
  @ApiOperation({ summary: 'List members' })
  @HttpCode(HttpStatus.OK)
  listMembers() {}

  @InverterRoles(InverterRole.ADMIN)
  @Get(':userId')
  @ApiOperation({ summary: 'Get one member' })
  @HttpCode(HttpStatus.OK)
  getMember() {}

  @InverterRoles(InverterRole.ADMIN)
  @Patch(':userId')
  @ApiOperation({ summary: 'update a user role' })
  @HttpCode(HttpStatus.OK)
  updateMemberRole() {}

  @InverterRoles(InverterRole.ADMIN)
  @Delete(':userId')
  @ApiOperation({ summary: "Revoke a user's access" })
  @HttpCode(HttpStatus.OK)
  revokeUserAccess() {}
}
