import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Waitlist } from './entities/waitlist.entity';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import type { Response } from 'express';
import { SYS_MSG } from '../../common/constants/sys-msg';

@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Waitlist)
    private readonly waitlistRepository: Repository<Waitlist>,
  ) { }

  async join(dto: JoinWaitlistDto, response: Response) {
    const email = dto.email.trim();

    const existingUser = await this.userRepository.findOneBy({ email });
    if (existingUser) {
      response.status(HttpStatus.OK);
      return { message: SYS_MSG.WAITLIST_EXISTING };
    }

    const existingSubscriber = await this.waitlistRepository.findOneBy({
      email,
    });
    if (existingSubscriber) {
      response.status(HttpStatus.OK);
      return { message: SYS_MSG.WAITLIST_EXISTING };
    }

    const subscriber = this.waitlistRepository.create({ email });
    await this.waitlistRepository.save(subscriber);

    response.status(HttpStatus.CREATED);
    return { message: SYS_MSG.WAITLIST_SUCCESS };
  }
}
