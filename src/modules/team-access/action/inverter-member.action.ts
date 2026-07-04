import { AbstractModelAction } from '@hng-sdk/orm';
import { InverterMember } from '../entities/inverter-members.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';

@Injectable()
export class InverterMemberModelAction extends AbstractModelAction<InverterMember> {
  constructor(
    @InjectRepository(InverterMember) repository: Repository<InverterMember>,
  ) {
    super(repository, InverterMember);
  }
}
