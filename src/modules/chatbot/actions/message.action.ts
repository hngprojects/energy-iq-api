import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable } from '@nestjs/common';
import { Message } from '../entities/message.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { noTransaction } from '../../../common/constants/transaction-options';

@Injectable()
export class MessageModelAction extends AbstractModelAction<Message> {
  constructor(@InjectRepository(Message) repository: Repository<Message>) {
    super(repository, Message);
  }

  async findByChatId(chatId: string): Promise<Message[]> {
    return this.repository.find({
      where: { chat: { id: chatId } },
      order: { createdAt: 'ASC' },
    });
  }

  async getMessagesWithCount(
    chatId: string,
    count: number,
  ): Promise<Message[]> {
    // Fetch the N most recent messages, then reverse so they are oldest-first.
    // The agent expects [oldest ... newest] so that messages[messages.length-1]
    // is always the current user message.
    const rows = await this.repository.find({
      where: { chat: { id: chatId } },
      order: { createdAt: 'DESC' },
      take: count,
    });
    return rows.reverse();
  }

  async saveMessage(message: Partial<Message>) {
    return this.create({
      createPayload: message,
      ...noTransaction(),
    });
  }

  async saveMessages(messages: Message[]) {
    return this.repository.save(messages);
  }

  async updateMessageById(id: string, data: Partial<Message>) {
    return this.update({
      updatePayload: data,
      identifierOptions: {
        id,
      },
      transactionOptions: {
        useTransaction: false,
      },
    });
  }
}
