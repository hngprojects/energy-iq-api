import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inverter } from '../entities/inverters.entity';
import { InverterBrand } from '../../../common/enums';

@Injectable()
export class InverterModelAction extends AbstractModelAction<Inverter> {
  constructor(
    @InjectRepository(Inverter)
    repository: Repository<Inverter>,
  ) {
    super(repository, Inverter);
  }

  async findBySerialNumber(serialNumber: string): Promise<Inverter | null> {
    return this.get({ identifierOptions: { serialNumber } });
  }

  async findByInstallationId(installationId: string): Promise<Inverter | null> {
    return this.get({ identifierOptions: { installationId } });
  }

  async findSpecificBrand(brand: InverterBrand): Promise<Inverter[]> {
    return this.repository.find({ where: { brand } });
  }

  async findByUserId(userId: string): Promise<Inverter[]> {
    return this.repository.find({ where: { userId } });
  }

  async findIdsByUserId(userId: string): Promise<string[]> {
    const inverters = await this.repository.find({
      where: { userId },
      select: ['id'],
    });
    return inverters.map((inv) => inv.id);
  }

  /**
   * Returns the ID of the first (oldest) inverter registered for a user.
   * By design each user should have exactly one inverter, but this guards
   * against any case where multiple exist — agents should only act on the
   * first one to avoid ambiguous results.
   */
  async findFirstIdByUserId(userId: string): Promise<string | null> {
    const inverter = await this.repository.findOne({
      where: { userId },
      select: ['id'],
      order: { createdAt: 'ASC' },
    });
    return inverter?.id ?? null;
  }

  async findActiveByUserId(userId: string): Promise<Inverter[]> {
    return this.repository.find({ where: { userId, isActive: true } });
  }

  async deactivateById(id: string): Promise<void> {
    await this.repository.update({ id }, { isActive: false });
  }

  async activateById(id: string): Promise<void> {
    await this.repository.update({ id }, { isActive: true });
  }

  async markOffline(id: string): Promise<void> {
    await this.repository.update({ id }, { isOffline: true });
  }

  async markOnline(id: string): Promise<void> {
    await this.repository.update({ id }, { isOffline: false });
  }
}
