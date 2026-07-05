import { AbstractModelAction } from '@hng-sdk/orm';
import { InverterMember } from '../entities/inverter-members.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { noTransaction } from '../../../common/constants/transaction-options';
import { InverterMemberStatus } from '../../../common/enums/inverter-role.enum';

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

  async findByEmail(email: string): Promise<InverterMember[]> {
    const res = await this.find({
      ...noTransaction(),
      findOptions: {
        email,
      },
      paginationPayload: {
        page: 1,
        limit: 100,
      },
    });

    return res.payload;
  }

  findInviteWithStatusByUserId(userId: string, status: InverterMemberStatus) {
    return this.repository.find({
      where: {
        userId,
        status,
      },
    });
  }
}
