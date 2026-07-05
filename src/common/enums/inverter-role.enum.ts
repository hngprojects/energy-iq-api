export enum InverterRole {
  OWNER = 'inverter_owner',
  ADMIN = 'inverter_admin',
  TECHNICIAN = 'inverter_technician',
  VIEWER = 'inverter_viewer',
}

export enum InverterMemberStatus {
  INVITED = 'invited',
  ACTIVE = 'active',
  DEACTIVATED = 'deactivated',
}

export const INVERTER_ROLE_RANK: Record<InverterRole, number> = {
  [InverterRole.OWNER]: 4,
  [InverterRole.ADMIN]: 3,
  [InverterRole.TECHNICIAN]: 2,
  [InverterRole.VIEWER]: 1
}
