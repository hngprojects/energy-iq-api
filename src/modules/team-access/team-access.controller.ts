import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InverterRoleGuard } from '../../common/guards/inverter-role.guard';
import { InverterRoles } from '../../common/decorators/inverter-roles.decorator';
import { InverterRole } from '../../common/enums/inverter-role.enum';
import { TeamAccessService } from './team-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@ApiBearerAuth()
@UseGuards(InverterRoleGuard)
@Controller('/inverters/:inverterId/team-access')
export class TeamAccessController {
  constructor(private readonly teamAccessService: TeamAccessService) {}

  @InverterRoles(InverterRole.ADMIN)
  @Post('invite')
  @ApiOperation({ summary: 'invite member to view inverter' })
  @HttpCode(HttpStatus.CREATED)
  inviteMember(
    @Param('inverterId', ParseUUIDPipe) inverterId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.teamAccessService.inviteMember(dto, inverterId, userId);
  }

  @InverterRoles(InverterRole.ADMIN)
  @Get('')
  @ApiOperation({ summary: 'List members' })
  @HttpCode(HttpStatus.OK)
  listMembers(@Param('inverterId', ParseUUIDPipe) inverterId: string) {
    return this.teamAccessService.listMembers(inverterId);
  }

  @InverterRoles(InverterRole.ADMIN)
  @Get(':userId')
  @ApiOperation({ summary: 'Get one member' })
  @HttpCode(HttpStatus.OK)
  getMember(
    @Param('inverterId', ParseUUIDPipe) inverterId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.teamAccessService.getMember(inverterId, userId);
  }

  @InverterRoles(InverterRole.ADMIN)
  @Patch(':userId')
  @ApiOperation({ summary: 'update a user role' })
  @HttpCode(HttpStatus.OK)
  updateMemberRole(
    @Param('inverterId', ParseUUIDPipe) inverterId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.teamAccessService.updateMemberRole(
      inverterId,
      userId,
      dto.role,
    );
  }

  @InverterRoles(InverterRole.ADMIN)
  @Delete(':userId')
  @ApiOperation({ summary: "Revoke a user's access" })
  @HttpCode(HttpStatus.OK)
  revokeUserAccess(
    @Param('inverterId', ParseUUIDPipe) inverterId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.teamAccessService.revokeMemberAccess(inverterId, userId);
  }
}
