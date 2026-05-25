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
  private readonly model: ChatGroq;
  private readonly botName: string;
  private readonly alertReader: AlertReader;

  constructor(
    alertReader: AlertReader,
    @Inject(chatbotConfig.KEY)
    chatBotCfg: ConfigType<typeof chatbotConfig>,
  ) {
    this.model = new ChatGroq({ model: 'llama-3.1-8b-instant' });
    this.botName = chatBotCfg.chatbotName;
    this.alertReader = alertReader;
    // this.agent = createAgent({
    //   model: groq,
    //   tools: [alertReader.create()],
    //   systemPrompt: SYSTEM_PROMPT,
    //   name: chatBotCfg.chatbotName,
    // });
  }

  async invokeWithHistory(
    messages: Message[],
    userId: string,
    preferredLanguage?: string,
  ) {
    const agent = this.buildAgent(userId);

    // Filter out messages that contain raw tool call syntax — these are
    // intermediate agent reasoning steps that confuse the model when replayed
    // as history. Only pass clean human messages and clean AI text responses.
    const agentMessages = messages
      .filter((msg) => {
        const content = msg.content ?? '';
        // Drop messages that look like raw tool invocations or empty messages
        if (!content.trim()) return false;
        if (content.includes('<function=')) return false;
        if (content.includes('(function=')) return false;
        return true;
      })
      .map((msg) => {
        if (msg.senderId === SYSTEM_SENDER_ID)
          return new AIMessage(msg.content);
        return new HumanMessage(msg.content);
      });

    const contextMessages = preferredLanguage
      ? [
          new HumanMessage(
            `Respond in ${preferredLanguage}. This is the user's preferred language setting.`,
          ),
          ...agentMessages,
        ]
      : agentMessages;

    const response = await agent.invoke({
      messages: contextMessages,
    });
    const msgs = response.messages;
    return msgs[msgs.length - 1].content;
  }

  async invoke(message: string, userId: string) {
    const agent = this.buildAgent(userId);
    const response = await agent.invoke({
      messages: [new HumanMessage(message)],
    });
    const messages = response.messages;
    return messages[messages.length - 1].content;
  }

  private buildAgent(userId: string): ReactAgent {
    return createAgent({
      model: this.model,
      tools: [this.alertReader.create(userId)],
      systemPrompt: SYSTEM_PROMPT,
      name: this.botName,
    });
  }
}
