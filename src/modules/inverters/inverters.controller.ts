import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ParseUUIDPipe } from '@nestjs/common/pipes/parse-uuid.pipe';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { InverterConnectorDto } from './dto/inverter-connector.dto';
import { InvertersService } from './inverters.service';
import { InverterRoleGuard } from '../../common/guards/inverter-role.guard';
import { InverterRoles } from '../../common/decorators/inverter-roles.decorator';
import { InverterRole } from '../../common/enums/inverter-role.enum';

@ApiTags('Inverters')
@ApiBearerAuth()
@Controller({ path: 'inverters', version: '1' })
export class InvertersController {
  constructor(private readonly invertersService: InvertersService) {}

  @Post('connect')
  @ApiOperation({ summary: 'Connect an inverter to the authenticated user' })
  connect(
    @Body() dto: InverterConnectorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invertersService.connectInverter(dto, user.sub);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all inverters for a user' })
  findByUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.invertersService.findByUserId(userId);
  }

  @Get('supported-brands')
  @ApiOperation({ summary: 'Get supported inverter brands' })
  getSupportedBrands() {
    return this.invertersService.getSupportedInverterBrands();
  }

  @InverterRoles(InverterRole.OWNER)
  @UseGuards(InverterRoleGuard)
  @Patch(':inverterId/deactivate')
  @ApiOperation({ summary: 'Deactivate an inverter (owner only)' })
  deactivate(
    @Param('inverterId', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invertersService.deactivateInverter(id, user.sub);
  }

  @InverterRoles(InverterRole.VIEWER)
  @UseGuards(InverterRoleGuard)
  @Get(':inverterId')
  @ApiOperation({ summary: 'Get a single inverter by ID' })
  findOne(@Param('inverterId', ParseUUIDPipe) id: string) {
    return this.invertersService.findOne(id);
  }
}
