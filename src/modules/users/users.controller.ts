import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
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
import { FileInterceptor } from '@nestjs/platform-express';

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

  @Patch('settings/personal')
  @ApiOperation({ summary: 'Update personal / business settings and name' })
  updatePersonalSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserPersonalSettingsDto,
  ) {
    return this.usersService.updatePersonalSettings(user.sub, dto);
  }

  @Get('settings/personal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get a user's settings" })
  getUserSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getUserSettings(user.sub);
  }

  @Post('settings/personal/img')
  @ApiOperation({ summary: 'Upload a profile image' })
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  uploadProfileImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5 MB
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|jpg|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.uploadProfileImage(
      {
        file,
        userId: user.sub,
        userEmail: user.email,
      },
      user.sub,
    );
  }
}
