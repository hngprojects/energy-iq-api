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

  findByInverterIdAndEmail(
    inverterId: string,
    email: string,
  ): Promise<InverterMember | null> {
    return this.get({
      identifierOptions: {
        inverterId,
        email,
      },
    });
  }

  findByTokenAndEmail(
    token: string,
    email: string,
  ): Promise<InverterMember | null> {
    return this.get({
      identifierOptions: {
        inviteToken: token,
        email,
      },
    });
  }
}
