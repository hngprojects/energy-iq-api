import { Inject, Injectable } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { chatbotConfig } from '../../config/chatbot.config';
import { AIMessage, createAgent, HumanMessage, ReactAgent } from 'langchain';
import { ChatGroq } from '@langchain/groq';
import { AlertReader } from './agent-tools/alert-reader';
import { SYSTEM_PROMPT } from './helpers/prompts';
import { Message } from './entities/message.entity';
import { SYSTEM_SENDER_ID } from './helpers/constants';

@Injectable()
export class AgentService {
  private readonly agent!: ReactAgent;

  constructor(
    alertReader: AlertReader,
    @Inject(chatbotConfig.KEY)
    chatBotCfg: ConfigType<typeof chatbotConfig>,
  ) {
    const groq = new ChatGroq({ model: 'llama-3.1-8b-instant' });
    this.agent = createAgent({
      model: groq,
      tools: [alertReader.create()],
      systemPrompt: SYSTEM_PROMPT,
      name: chatBotCfg.chatbotName,
    });
  }

  async invokeWithHistory(messages: Message[]) {
    const agentMessages = messages.map((msg) => {
      if (msg.senderId === SYSTEM_SENDER_ID) return new AIMessage(msg.content);
      return new HumanMessage(msg.content);
    });
    const response = (await this.agent.invoke({
      messages: agentMessages,
    })) as unknown as AIMessage;
    return response;
  }

  async invoke(message: string) {
    const response = await this.agent.invoke({
      messages: [new HumanMessage(message)],
    });
    const messages = response.messages;
    return messages[messages.length - 1].content;
  }
}
