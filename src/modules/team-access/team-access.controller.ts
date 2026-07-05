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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InverterRoleGuard } from '../../common/guards/inverter-role.guard';
import { InverterRoles } from '../../common/decorators/inverter-roles.decorator';
import { InverterRole } from '../../common/enums/inverter-role.enum';
import { TeamAccessService } from './team-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { InverterOutsider } from '../../common/decorators/inverter-outsider.decorator';

@ApiTags('Team Access')
@ApiBearerAuth()
@UseGuards(InverterRoleGuard)
@Controller('team-access')
export class TeamAccessController {
  constructor(private readonly teamAccessService: TeamAccessService) {}

  @InverterOutsider()
  @Get('invites')
  @ApiOperation({ summary: 'Get all invites for a user' })
  @HttpCode(HttpStatus.OK)
  getUserInvites(@CurrentUser('sub') userId: string) {
    return this.teamAccessService.getUserInvites(userId);
  }

  @InverterOutsider()
  @Get('memberships')
  @ApiOperation({ summary: 'Get all invites for a user' })
  @HttpCode(HttpStatus.OK)
  getUserMemberships(@CurrentUser('sub') userId: string) {
    return this.teamAccessService.getUserMemberships(userId);
  }

  @InverterRoles(InverterRole.ADMIN)
  @Post(':inverterId/invite')
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
  @Get(':inverterId')
  @ApiOperation({ summary: 'List members' })
  @HttpCode(HttpStatus.OK)
  listMembers(@Param('inverterId', ParseUUIDPipe) inverterId: string) {
    return this.teamAccessService.listMembers(inverterId);
  }

  @InverterRoles(InverterRole.ADMIN)
  @Get(':inverterId/:memberId')
  @ApiOperation({ summary: 'Get one member' })
  @HttpCode(HttpStatus.OK)
  getMember(
    @Param('inverterId', ParseUUIDPipe) inverterId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.teamAccessService.getMember(inverterId, memberId);
  }

  @InverterRoles(InverterRole.ADMIN)
  @Patch(':inverterId/:memberId')
  @ApiOperation({ summary: 'update a user role' })
  @HttpCode(HttpStatus.OK)
  updateMemberRole(
    @Param('inverterId', ParseUUIDPipe) inverterId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.teamAccessService.updateMemberRole(
      inverterId,
      memberId,
      dto.role,
    );
  }

  @InverterRoles(InverterRole.ADMIN)
  @Delete(':inverterId/:memberId')
  @ApiOperation({ summary: "Revoke a user's access" })
  @HttpCode(HttpStatus.OK)
  revokeUserAccess(
    @Param('inverterId', ParseUUIDPipe) inverterId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.teamAccessService.revokeMemberAccess(inverterId, memberId);
  }

  @InverterRoles(InverterRole.ADMIN)
  @Post(':inverterId/:inviteId')
  @ApiOperation({ summary: 'Refresh an invite if it has expired' })
  @HttpCode(HttpStatus.OK)
  refreshInvite(
    @Param('inviteId') inviteId: string,
    @Param('inverterId') inverterId: string,
  ) {
    return this.teamAccessService.refreshUserInvite(inviteId, inverterId);
  }
}
