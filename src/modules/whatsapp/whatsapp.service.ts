import { Inject, Injectable, Logger } from '@nestjs/common';
import Twilio from 'twilio';
import { whatsAppConfig } from '../../config/whatsapp.config';
import { type ConfigType } from '@nestjs/config';
import { SendWhatsAppDto } from './dto/send-message.dto';

@Injectable()
export class WhatsappService {
  private readonly client: Twilio.Twilio;
  private readonly from: string;
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @Inject(whatsAppConfig.KEY)
    private readonly whatsAppCfg: ConfigType<typeof whatsAppConfig>,
  ) {
    this.client = Twilio(
      this.whatsAppCfg.twilioAccountSid,
      this.whatsAppCfg.twilioAuthToken,
    );
    this.from = `whatsapp:${this.whatsAppCfg.twilioWhatsAppFrom}`;
  }

  async sendMessage(dto: SendWhatsAppDto): Promise<string> {
    const to = `whatsapp:${dto.to}`;

    try {
      const message = await this.client.messages.create({
        from: this.from,
        to,
        ...(dto.contentSid
          ? {
              contentSid: dto.contentSid,
              contentVariables: dto.contentVariables
                ? JSON.stringify(dto.contentVariables)
                : undefined,
            }
          : { body: dto.body }),
      });

      this.logger.log(`WhatsApp message sent -> SID: ${message.sid}`);
      return message.sid;
    } catch (err) {
      this.logger.error(
        `WhatsApp send failed -> ${err instanceof Error ? err.message : (err as string)}`,
      );
      throw err;
    }
  }

  async sendText(to: string, body: string): Promise<string> {
    return this.sendMessage({ to, body });
  }
}
