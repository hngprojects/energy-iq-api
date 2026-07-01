import { AbstractModelAction } from '@hng-sdk/orm';
import { Session } from '../entities/sessions.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export class SessionModelAction extends AbstractModelAction<Session> {
  constructor(@InjectRepository(Session) repository: Repository<Session>) {
    super(repository, Session);
  }

  findById(id: string): Promise<Session | null> {
    return this.get({ identifierOptions: { id } });
  }
}
