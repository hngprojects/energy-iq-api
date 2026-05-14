// TRD says backend receives plain text password, so we hash here
export interface SolarmanTokenRequest {
  appId: string;
  appSecret: string;
  email: string;
  password: string; // MD5 hash of the plain-text password
}

export interface SolarmanTokenResponse {
  code: string;
  msg: string;
  success: boolean;
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  uid: string;
}

export interface SolarmanStation {
  id: number;
  name: string;
  locationLat: number;
  locationLng: number;
  locationAddress: string;
  regionNationId: number;
  regionLevel1: number;
  regionLevel2: number;
  regionLevel3: number;
  regionLevel4: number;
  regionLevel5: number;
  type: string;
  gridInterconnectionType: string;
  installedCapacity: number; // kW
  startOperatingTime: number; // unix timestamp
  stationImage: string;
  contactPhone: string;
  ownerName: string;
}

export interface SolarmanStationListResponse {
  code: string;
  msg: string;
  success: boolean;
  requestId: string;
  total: number;
  stationList: SolarmanStation[];
}

export interface SolarmanDeviceItem {
  deviceSn: string;
  deviceId: number;
  deviceType: string;
  deviceState: number;
  collectionTime: number;
}

export interface SolarmanDeviceListResponse {
  code: string;
  msg: string;
  success: boolean;
  requestId: string;
  deviceListItems: SolarmanDeviceItem[];
}

export interface SolarmanDataPoint {
  key: string;
  value: string;
  unit: string | null;
  name?: string;
}

export interface SolarmanCurrentDataResponse {
  code: string;
  msg: string;
  success: boolean;
  requestId: string;
  data: {
    deviceSn: string;
    deviceId: number;
    deviceType: string;
    deviceState: number;
    collectionTime: number; // unix timestamp
    dataList: SolarmanDataPoint[];
  };
}

export const SOLARMAN_KEYS = {
  BATTERY_SOC: 'SoC', // %
  TOTAL_PV_POWER: 'TotalPower', // W — total PV input
  AC_OUTPUT_POWER: 'Pac', // W — AC output to loads
  DAILY_PV_GENERATION: 'DailyPVGeneration', // kWh
  TOTAL_PV_GENERATION: 'TotalPVGeneration', // kWh
  GRID_FREQUENCY: 'GridFrequency', // Hz
  GRID_VOLTAGE: 'GridVoltage', // V
} as const;
