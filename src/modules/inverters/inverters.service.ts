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
import { SandboxAdapter } from './adapters/sandbox.adapter';

@Injectable()
export class InvertersService {
  constructor(
    private readonly victronAdapter: VictronAdapter,
    private readonly growattAdapter: GrowattAdapter,
    private readonly sunsynkAdapter: SunsynkAdapter,
    private readonly sandboxAdapter: SandboxAdapter,
    private readonly inverterModelAction: InverterModelAction,
  ) {}

  async connectInverter(
    dto: InverterConnectorDto,
    userId: string,
  ): Promise<Inverter> {
    return (await this.connectInverterWithMeta(dto, userId)).inverter;
  }

  async connectInverterWithMeta(
    dto: InverterConnectorDto,
    userId: string,
  ): Promise<{ inverter: Inverter; created: boolean }> {
    switch (dto.brand) {
      case InverterBrand.VICTRON:
        return { inverter: await this.connectVictronInverter(dto, userId), created: true };
      case InverterBrand.GROWATT:
        return { inverter: await this.connectGrowattInverter(dto, userId), created: true };
      case InverterBrand.SUNSYNK:
        return { inverter: await this.connectSunsynkInverter(dto, userId), created: true };
      case InverterBrand.SANDBOX:
        return this.connectSandboxInverter(dto, userId);
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

  async connectSandboxInverter(dto: InverterConnectorDto, userId: string): Promise<{ inverter: Inverter; created: boolean }> {
    const token = dto.sandboxAccessToken!;
    const systemData = await this.sandboxAdapter.verifyAndGetSandboxSystem(token);
    return this.persistSandboxInverter(systemData, token, userId);
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
   * Sandbox-specific persistence: skips the duplicate serial check so multiple
   * users can connect to the same sandbox installation (9001, 9002, 9003).
   * Each user gets their own inverter record keyed by {serialNumber}-{userId}.
   * If the same user reconnects, the existing record is returned (idempotent).
   */
  private async persistSandboxInverter(
    systemData: VerifiedSystem,
    rawCredential: string,
    userId: string,
  ): Promise<{ inverter: Inverter; created: boolean }> {
    const sandboxSerial = `${systemData.serialNumber}-${userId}`;

    // Idempotent: return existing record if this user already connected this installation
    const existing =
      await this.inverterModelAction.findBySerialNumber(sandboxSerial);
    if (existing) {
      return { inverter: existing, created: false };
    }

    const encryptedCredentials = SecretManager.encrypt(rawCredential);

    const inverter = await this.inverterModelAction.create({
      ...noTransaction(),
      createPayload: {
        userId,
        model: systemData.model,
        brand: InverterBrand.SANDBOX,
        serialNumber: sandboxSerial,
        installationId: systemData.installationId,
        ratedCapacityKwh: systemData.ratedCapacityKwh,
        apiType: InverterApiType.LIVE_API,
        encryptedCredentials,
      },
    });

    return { inverter, created: true };
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
