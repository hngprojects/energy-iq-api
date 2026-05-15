import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { ContactService } from './contact.service';
import { ContactUsDto } from './dto/contact-us.dto';

@ApiTags('Contact')
@Controller({ path: 'contact', version: '1' })
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 600000 } })
  @ApiOperation({ summary: 'Send a contact us message' })
  sendMessage(@Body() dto: ContactUsDto) {
    return this.contactService.sendContactMessage(dto);
  }
}
