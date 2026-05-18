import { registerAs } from '@nestjs/config';
import { env } from './env';

export const whatsAppConfig = registerAs('whatsapp', () => ({
  twilioAccountSid: env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: env.TWILIO_AUTH_TOKEN,
  twilioWhatsAppFrom: env.TWILIO_WHATSAPP_FROM,
}));
