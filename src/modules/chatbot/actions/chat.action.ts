import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable } from '@nestjs/common';
import { Chat } from '../entities/chat.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { noTransaction } from '../../../common/constants/transaction-options';

@Injectable()
export class ChatModelAction extends AbstractModelAction<Chat> {
  constructor(
    @InjectRepository(Chat)
    repository: Repository<Chat>,
  ) {
    super(repository, Chat);
  }

  async createChat(chat: Partial<Chat>) {
    return this.create({
      ...noTransaction(),
      createPayload: chat,
    });
  }

  async findActiveChatsByUserId(userId: string): Promise<Chat[]> {
    const activeChats = await this.find({
      ...noTransaction(),
      findOptions: {
        userId,
      },
    });
    return activeChats.payload;
  }

  findById(id: string): Promise<Chat | null> {
    return this.get({ identifierOptions: { id } });
  }

  async findByUserId(userId: string): Promise<Chat[]> {
    const result = await this.find({
      findOptions: {
        userId,
      },
      ...noTransaction(),
    });
    return result.payload;
  }
}
