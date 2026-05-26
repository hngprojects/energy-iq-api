import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from '../entities/user-settings.entity';

@Injectable()
export class UserSettingsModelAction extends AbstractModelAction<UserSettings> {
  constructor(
    @InjectRepository(UserSettings) repository: Repository<UserSettings>,
  ) {
    super(repository, UserSettings);
  }

  // find settings record by the owning user's ID
  async findByUserId(userId: string): Promise<UserSettings | null> {
    return this.repository.findOne({
      where: { user: { id: userId } },
    });
  }

  async getSettingValue<K extends keyof UserSettings>(
    userId: string,
    settingName: K,
  ): Promise<UserSettings[K] | null> {
    const result = await this.repository.findOne({
      where: { user: { id: userId } },
      select: ['id', settingName],
    });

    return result ? result[settingName] : null;
  }
}
