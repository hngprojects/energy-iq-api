import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { WaitlistService } from './waitlist.service';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import type { Response } from 'express';
import { PaginationDto } from '../../common/dto/pagination.do';

@ApiTags('Waitlist')
@Controller({ path: 'waitlist', version: '1' })
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Public()
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Join the early access waitlist' })
  @ApiResponse({ status: 200, description: 'User already exists' })
  @ApiResponse({ status: 201, description: 'Subscriber created successfully' })
  joinWaitlist(
    @Body() dto: JoinWaitlistDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.waitlistService.join(dto, response);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all waitlist subscribers' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.waitlistService.findAll(paginationDto);
  }
}

