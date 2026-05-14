import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InverterConnectorDto } from './dto/inverter-connector.dto';
import { GrowattAdapter } from './adapters/growatt.adapter';
import { SunsynkAdapter } from './adapters/sunsynk.adapter';
import { VictronAdapter } from './adapters/victron.adapters';
import { Inverter } from './entities/inverters.entity';
import { InverterModelAction } from './action/inverters.action';
import { noTransaction } from '../../common/constants/transaction-options';
import { SYS_MSG } from '../../common/constants/sys-msg';
import { VerifiedSystem } from './types/shared.types';
import { InverterApiType, InverterBrand } from '../../common/enums';
import { SecretManager } from '../../common/utils/crypto.utils';

@Injectable()
export class InvertersService {
  constructor(
    private readonly victronAdapter: VictronAdapter,
    private readonly growattAdapter: GrowattAdapter,
    private readonly sunsynkAdapter: SunsynkAdapter,
    private readonly inverterModelAction: InverterModelAction,
  ) {}

  async connectInverter(
    dto: InverterConnectorDto,
    userId: string,
  ): Promise<Inverter> {
    switch (dto.brand) {
      case InverterBrand.VICTRON:
        return this.connectVictronInverter(dto, userId);
      case InverterBrand.GROWATT:
        return this.connectGrowattInverter(dto, userId);
      case InverterBrand.SUNSYNK:
        return this.connectSunsynkInverter(dto, userId);
      default:
        throw new ConflictException(
          `Unsupported inverter brand: ${dto.brand as string}`,
        );
    }
  }

  async connectVictronInverter(
    dto: InverterConnectorDto,
    userId: string,
  ): Promise<Inverter> {
    const token = dto.victronAccessToken!;
    const systemData =
      await this.victronAdapter.verifyAndGetVictronSystem(token);
    return this.persistInverter(
      systemData,
      InverterBrand.VICTRON,
      token,
      userId,
    );
  }

  async connectGrowattInverter(
    dto: InverterConnectorDto,
    userId: string,
  ): Promise<Inverter> {
    const token = dto.growattApiToken!;
    const systemData =
      await this.growattAdapter.verifyAndGetGrowattSystem(token);
    return this.persistInverter(
      systemData,
      InverterBrand.GROWATT,
      token,
      userId,
    );
  }

  async connectSunsynkInverter(
    dto: InverterConnectorDto,
    userId: string,
  ): Promise<Inverter> {
    const email = dto.solarmanEmail!;
    const password = dto.solarmanPassword!;
    const systemData = await this.sunsynkAdapter.verifyAndGetSunsynkSystem(
      email,
      password,
    );
    // Store email:password as the credential — encrypted at rest
    const rawCredential = `${email}:${password}`;
    return this.persistInverter(
      systemData,
      InverterBrand.SUNSYNK,
      rawCredential,
      userId,
    );
  }

  /**
   * Shared persistence logic: checks for duplicate serial, encrypts credentials,
   * and writes the inverter record.
   */
  private async persistInverter(
    systemData: VerifiedSystem,
    brand: InverterBrand,
    rawCredential: string,
    userId: string,
  ): Promise<Inverter> {
    const existing = await this.inverterModelAction.findBySerialNumber(
      systemData.serialNumber,
    );
    if (existing) {
      throw new ConflictException(
        `This ${brand} installation is already connected to an account.`,
      );
    }

    const encryptedCredentials = SecretManager.encrypt(rawCredential);

    return this.inverterModelAction.create({
      ...noTransaction(),
      createPayload: {
        userId,
        model: systemData.model,
        brand,
        serialNumber: systemData.serialNumber,
        installationId: systemData.installationId,
        ratedCapacityKwh: systemData.ratedCapacityKwh,
        apiType: InverterApiType.LIVE_API,
        encryptedCredentials,
      },
    });
  }

  async findByUserId(userId: string): Promise<Inverter[]> {
    const inverters = await this.inverterModelAction.findActiveByUserId(userId);
    if (!inverters?.length) throw new NotFoundException(SYS_MSG.NOT_FOUND);
    return inverters;
  }

  async findOne(id: string): Promise<Inverter> {
    const inverter = await this.inverterModelAction.get({
      identifierOptions: { id },
    });
    if (!inverter) throw new NotFoundException(SYS_MSG.NOT_FOUND);
    return inverter;
  }

  async deactivateInverter(
    inverterId: string,
    requestingUserId: string,
  ): Promise<Inverter> {
    const inverter = await this.inverterModelAction.get({
      identifierOptions: { id: inverterId },
    });

    if (!inverter) throw new NotFoundException(SYS_MSG.NOT_FOUND);
    if (inverter.userId !== requestingUserId)
      throw new ForbiddenException(SYS_MSG.FORBIDDEN);
    if (!inverter.isActive)
      throw new ConflictException(SYS_MSG.INVERTER_ALREADY_INACTIVE);

    await this.inverterModelAction.deactivateById(inverterId);
    return { ...inverter, isActive: false };
  }

  getSupportedInverterBrands(): InverterBrand[] {
    return Object.values(InverterBrand);
  }
}
