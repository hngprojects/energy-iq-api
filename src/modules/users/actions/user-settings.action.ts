import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from '../entities/user-settings.entity';

@Injectable()
export class UserSettingsModelAction extends AbstractModelAction<UserSettings> {
  constructor(@InjectRepository(UserSettings) repository: Repository<UserSettings>) {
    super(repository, UserSettings);
  }

  // find settings record by the owning user's ID
  async findByUserId(userId: string): Promise<UserSettings | null> {
    return this.repository.findOne({
      where: { user: {  id: userId } },
    });
  }
}
