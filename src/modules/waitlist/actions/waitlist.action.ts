import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Waitlist } from '../entities/waitlist.entity';

@Injectable()
export class WaitlistModelAction extends AbstractModelAction<Waitlist> {
  constructor(@InjectRepository(Waitlist) repository: Repository<Waitlist>) {
    super(repository, Waitlist);
  }
}
