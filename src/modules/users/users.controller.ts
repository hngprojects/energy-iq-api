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
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Response } from 'express';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { InverterConnectorDto } from '../inverters/dto/inverter-connector.dto';
import { PaginationDto } from '../../common/dto/pagination.do';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserPersonalSettingsDto } from './dto/update-user-personal-settings.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users (paginated)' })
  findAll(@Query() pagination: PaginationDto) {
    return this.usersService.findAll(pagination);
  }

  @Post('onboard')
  @ApiOperation({ summary: 'Connect user inverter brand' })
  async connectInverter(
    @Body() dto: InverterConnectorDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { inverter, created } = await this.usersService.connectUserInverter(
      dto,
      user.sub,
    );
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return inverter;
  }

  @Get('onboard/status')
  @ApiOperation({ summary: 'Get onboarding step and completion status' })
  getOnboardingStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getOnboardingStatus(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }

  /**
   * USER SETTINGS
   */

  @Patch(':id/settings/personal')
  @ApiOperation({ summary: 'Update user personal / business settings' })
  updatePersonalSettings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserPersonalSettingsDto,
  ) {
    return this.usersService.updatePersonalSettings(id, dto);
  }
}
