import { Inject, Injectable, Logger } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { chatbotConfig } from '../../config/chatbot.config';
import { createAgent, HumanMessage, ReactAgent } from 'langchain';
import { AlertReader } from './agent-tools/alert-reader';
import { SYSTEM_PROMPT } from './helpers/prompts';
import { Message } from './entities/message.entity';
import { SYSTEM_SENDER_ID } from './helpers/constants';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';
import { AgentCardResponse } from './types';

@Injectable()
export class AgentService {
  private readonly model: ChatGoogleGenerativeAI;
  private readonly botName: string;
  private readonly alertReader: AlertReader;
  private readonly logger = new Logger(AgentService.name);

  constructor(
    alertReader: AlertReader,
    @Inject(chatbotConfig.KEY)
    chatBotCfg: ConfigType<typeof chatbotConfig>,
  ) {
    this.model = new ChatGoogleGenerativeAI({
      model: 'gemini-3.5-flash',
      apiKey: chatBotCfg.geminiApiKey,
    });
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

  /**
   * Stream version: emits tokens via callback, returns the full accumulated text.
   *
   * @param messages - conversation history (must have the user's current message as last)
   * @param userId - user identifier
   * @param onToken - callback called for every text token chunk
   * @param preferredLanguage - optional language preference
   * @returns the complete bot response as a string
   */
  async invokeWithHistoryStream(
    messages: Message[],
    userId: string,
    onToken: (chunk: string) => void,
    preferredLanguage?: string,
  ): Promise<string> {
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
      const emptyMessage = 'No message to respond to.';
      onToken(emptyMessage);
      return emptyMessage;
    }

    const agent = this.buildAgent(
      userId,
      preferredLanguage,
      historyLines || undefined,
    );

    let fullContent = '';

    try {
      const stream = await agent.stream(
        { messages: [new HumanMessage(currentMessage.content)] },
        { recursionLimit: 10, streamMode: 'messages' },
      );

      for await (const [message, metadata] of stream) {
        if (metadata?.langgraph_node !== 'model_request') continue;

        if (
          message.content &&
          typeof message.content === 'string' &&
          message.content.trim()
        ) {
          fullContent += message.content;
          onToken(message.content);
        }
        // Tool-call chunks from the agent node have no text content — skip them.
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Streaming agent invocation failed: ${errMsg}`);

      if (!fullContent) {
        fullContent =
          'Sorry, something went wrong on my end. Please try again.';
        onToken(fullContent);
      }
    }

    return fullContent;
  }

  async invoke(message: string, userId: string) {
    const agent = this.buildAgent(userId);
    const response = await agent.invoke({
      messages: [new HumanMessage(message)],
    });
    const messages = response.messages;
    return messages[messages.length - 1].content;
  }

  /**
   * Generates a short title (3–6 words) for a chat based on the user's first message.
   * Returns null if generation fails — callers should handle that gracefully.
   */
  async generateChatTitle(firstUserMessage: string): Promise<string | null> {
    try {
      const titlePrompt =
        `You are a chat title generator. Given the user's first message, produce a short title ` +
        `of 3 to 6 words that captures the topic. Output ONLY the title — no punctuation at the ` +
        `end, no quotes, no explanation.\n\nUser message: ${firstUserMessage}`;

      const response = await this.model.invoke([
        { role: 'user', content: titlePrompt },
      ]);
      const title =
        typeof response.content === 'string'
          ? response.content.trim()
          : String(response.content).trim();
      return title || null;
    } catch {
      return null;
    }
  }

  /**
   * Generates structured cards from a completed agent response.
   *
   * Uses structured output (function-calling mode) so the schema is enforced
   * at the API level - not just requested in a prompt. Returns null if the
   * response doesn't warrant cards or if the call fails.
   *
   * This is intentionally a separate, non-streaming call that runs after the
   * main stream completes. It never blocks or delays the streaming response.
   */
  async generateCards(
    userMessage: string,
    agentResponse: string,
    preferredLanguage?: string,
  ): Promise<AgentCardResponse | null> {
    try {
      const cardSchema = z.object({
        cards: z.array(
          z.object({
            cardType: z.enum([
              'summary',
              'insight',
              'anomaly',
              'recommendation',
            ]),
            title: z.string(),
            content: z.string(),
            severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
          }),
        ),
      });

      const structuredModel = this.model.withStructuredOutput(cardSchema);

      const languageInstruction = preferredLanguage
        ? ` All card titles and content MUST be written in ${preferredLanguage}.`
        : '';

      const result = await structuredModel.invoke([
        {
          role: 'system',
          content:
            'You are a data formatter for an energy management assistant. ' +
            'Given a user question and the assistant response about a solar energy system, ' +
            'extract the key information into structured cards. ' +
            'Use these card types:\n' +
            '- summary: overall system status or a recap of findings\n' +
            '- insight: a notable pattern or observation worth highlighting\n' +
            '- anomaly: something unusual or potentially problematic (include severity)\n' +
            '- recommendation: a concrete action the user should take\n\n' +
            'IMPORTANT: Only produce cards when the response contains meaningful structured data ' +
            '(alerts, system status, trends, recommendations). ' +
            'If the response is a simple conversational reply, a greeting, or does not contain ' +
            'actionable energy data, return an empty cards array. ' +
            `Keep card content concise — one to three sentences maximum.${languageInstruction}`,
        },
        {
          role: 'user',
          content: `User asked: ${userMessage}\n\nAssistant responded: ${agentResponse}`,
        },
      ]);

      return result.cards.length > 0 ? (result as AgentCardResponse) : null;
    } catch {
      // Card generation is best-effort — never surface errors to the caller
      return null;
    }
  }

  private buildAgent(
    userId: string,
    preferredLanguage?: string,
    conversationHistory?: string,
  ): ReactAgent {
    let systemPrompt = SYSTEM_PROMPT;

    if (conversationHistory) {
      systemPrompt +=
        `\n\n## Conversation history\n` +
        `The following are PAST messages from earlier in this conversation. ` +
        `Use them for context only — do NOT re-answer or re-address anything already covered. ` +
        `Your ONLY task is to respond to the new user message that comes after this history.\n\n` +
        conversationHistory;
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
