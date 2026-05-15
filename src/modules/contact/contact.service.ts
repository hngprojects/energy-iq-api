import { Injectable } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { ContactUsDto } from './dto/contact-us.dto';

@Injectable()
export class ContactService {
  constructor(private readonly emailService: EmailService) {}

  async sendContactMessage(dto: ContactUsDto): Promise<void> {
    await this.emailService.sendContactUs(
      dto.firstName,
      dto.lastName,
      dto.email,
      dto.message,
      dto.phoneNumber,
    );
  }
}
