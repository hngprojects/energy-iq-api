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
    const result = await this.list({
      filterRecordOptions: { chat: { id: chatId } },
    });
    return result.payload;
  }

  async getMessagesWithCount(
    chatId: string,
    count: number,
  ): Promise<Message[]> {
    const result = await this.list({
      filterRecordOptions: { chat: { id: chatId } },
      paginationPayload: {
        limit: count,
        page: 1,
      },
      order: {
        createdAt: 'DESC',
      },
    });
    return result.payload;
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
