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
import { type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@ApiBearerAuth()
@UseGuards(InverterRoleGuard)
@Controller('/inverters/:inverterId/team-access')
export class TeamAccessController {
  constructor(private readonly teamAccessService: TeamAccessService) {}

  @InverterRoles(InverterRole.ADMIN)
  @Post('invite')
  @ApiOperation({ summary: 'Invite a member to the inverter group' })
  @HttpCode(HttpStatus.CREATED)
  inviteMember(
    @Param('inverterId', ParseUUIDPipe) inverterId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteMemberDto,
  ) {
    return this.teamAccessService.inviteMember(inverterId, user.sub, dto);
  }

  @InverterRoles(InverterRole.ADMIN)
  @Get('')
  @ApiOperation({ summary: 'List all members of the inverter group' })
  @HttpCode(HttpStatus.OK)
  listMembers(@Param('inverterId', ParseUUIDPipe) inverterId: string) {
    return this.teamAccessService.listMembers(inverterId);
  }

  @InverterRoles(InverterRole.ADMIN)
  @Get(':userId')
  @ApiOperation({ summary: 'Get a single member of the inverter group' })
  @HttpCode(HttpStatus.OK)
  getMember(
    @Param('inverterId', ParseUUIDPipe) inverterId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.teamAccessService.getMember(inverterId, userId);
  }

  @InverterRoles(InverterRole.ADMIN)
  @Patch(':userId')
  @ApiOperation({ summary: "Update a member's role" })
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
  @ApiOperation({ summary: "Revoke a member's access" })
  @HttpCode(HttpStatus.OK)
  revokeUserAccess(
    @Param('inverterId', ParseUUIDPipe) inverterId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.teamAccessService.revokeMemberAccess(inverterId, userId);
  }
}
