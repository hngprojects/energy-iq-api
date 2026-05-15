import { registerAs } from '@nestjs/config';
import { env } from './env';

export const chatbotConfig = registerAs('chatbot', () => ({
  chatbotName: env.CHATBOT_NAME,
  chatContextLength: env.CHAT_CONTEXT_LENGTH,
  chatExpirationTimeoutSeconds: env.CHAT_EXP_TIMEOUT_SECONDS,
  groqApiKey: env.GROQ_API_KEY,
}));
