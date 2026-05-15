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

  async findActiveByUserId(userId: string): Promise<Inverter[]> {
    return this.repository.find({ where: { userId, isActive: true } });
  }

  async deactivateById(id: string): Promise<void> {
    await this.repository.update({ id }, { isActive: false });
  }

  async activateById(id: string): Promise<void> {
    await this.repository.update({ id }, { isActive: true });
  }
}
