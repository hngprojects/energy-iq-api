import { SetMetadata } from '@nestjs/common';
import { InverterRole } from '../enums/inverter-role.enum';

export const INVERTER_ROLES_KEY = 'inverter_roles';
export const InverterRoles = (...roles: InverterRole[]) =>
  SetMetadata(INVERTER_ROLES_KEY, roles);
