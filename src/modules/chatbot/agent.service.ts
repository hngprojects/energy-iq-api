import { Inject, Injectable } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { chatbotConfig } from '../../config/chatbot.config';
import { createAgent, HumanMessage, ReactAgent } from 'langchain';
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
    this.model = new ChatGroq({ model: 'llama-3.3-70b-versatile' });
    this.botName = chatBotCfg.chatbotName;
    this.alertReader = alertReader;
  }

  async invokeWithHistory(
    messages: Message[],
    userId: string,
    preferredLanguage?: string,
  ) {
    // Build a readable conversation history from all messages except the last one.
    // This gets injected into the system prompt so the agent has context without
    // confusing the ReAct loop with raw message objects.
    const historyLines = messages
      .slice(0, -1)
      .filter((msg) => {
        const content = msg.content ?? '';
        if (!content.trim()) return false;
        if (content.includes('<function=')) return false;
        return true;
      })
      .map((msg) => {
        const role = msg.senderId === SYSTEM_SENDER_ID ? 'Assistant' : 'User';
        return `${role}: ${msg.content}`;
      })
      .join('\n');

    const currentMessage = messages[messages.length - 1];
    if (!currentMessage?.content?.trim()) {
      return 'No message to respond to.';
    }

    const agent = this.buildAgent(
      userId,
      preferredLanguage,
      historyLines || undefined,
    );

    const response = await agent.invoke(
      { messages: [new HumanMessage(currentMessage.content)] },
      { recursionLimit: 10 },
    );
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

  private buildAgent(
    userId: string,
    preferredLanguage?: string,
    conversationHistory?: string,
  ): ReactAgent {
    let systemPrompt = SYSTEM_PROMPT;

    if (conversationHistory) {
      systemPrompt += `\n\n## Conversation history\nThe following is the conversation so far. Use it for context when answering the user's latest message.\n\n${conversationHistory}`;
    }

    if (preferredLanguage) {
      systemPrompt += `\n\nThe user's preferred language is ${preferredLanguage}. Always respond in this language regardless of what they write in.`;
    }

    return createAgent({
      model: this.model,
      tools: [this.alertReader.create(userId)],
      systemPrompt,
      name: this.botName,
    });
  }
}
