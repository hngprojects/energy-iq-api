import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { GetNotificationsQuery } from './dto/get-notifications.query';
import { NotificationService } from './notification.service';
import { ReadNotificationDto } from './dto/read-notification.dto';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'get all notifications for a user' })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  getNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetNotificationsQuery,
  ) {
    return this.notificationService.getUserNotifications({
      ...query,
      userId: user.sub,
    });
  }

  @Get('unread')
  @ApiOperation({ summary: 'get all unread notifications for a user' })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  getUnreadNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetNotificationsQuery,
  ) {
    return this.notificationService.getUnreadNotifications({
      ...query,
      userId: user.sub,
    });
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'mark notification as read' })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  markNotificationAsRead(@Body() dto: ReadNotificationDto) {
    return this.notificationService.markAsRead(dto);
  }
}
