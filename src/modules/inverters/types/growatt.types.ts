// ─── Plant ───────────────────────────────────────────────────────────────────

export interface GrowattPlant {
  plant_id: number | string;
  name: string;
  current_power: string | number; // API returns a string e.g. "1559.0"
  total_energy: string | number;
  peak_power: number; // kW: rated panel capacity
  country?: string;
  city?: string;
  latitude?: string;
  longitude?: string;
  status?: number;
  create_date?: string;
}

/** GET /v1/plant/list — real shape: { data: { plants: [...], count: N } } */
export interface GrowattPlantListResponse {
  error_code: number;
  error_msg?: string;
  data: {
    plants: GrowattPlant[];
    count: number;
  };
}

// ─── Device ──────────────────────────────────────────────────────────────────

export interface GrowattDevice {
  device_id: string;
  device_sn: string;
  datalogger_sn: string;
  model: string;
  /**
   * Known values from the Growatt OpenAPI:
   *   1 = grid-tie inverter (min/tlx)
   *   2 = storage / hybrid inverter (spf / sph)
   *   3 = other
   */
  type: number;
  manufacturer: string;
  status?: number;
  lost?: boolean;
  last_update_time?: string;
}

/** GET /v1/device/list — real shape: { data: { devices: [...], count: N } } */
export interface GrowattDeviceListResponse {
  error_code: number;
  error_msg?: string;
  data: {
    devices: GrowattDevice[];
    count: number;
  };
}

// ─── queryLastData — min (grid-tie) ──────────────────────────────────────────

export interface GrowattMinData {
  serialNum: string;
  time: string; // "YYYY-MM-DD HH:mm:ss"
  status: number; // 0: waiting, 1: normal, 2: fault
  statusText?: string;

  ppv: number; // total PV input power (W)
  ppv1: number; // PV string 1 power (W)
  ppv2: number; // PV string 2 power (W)
  pac: number; // AC output power to loads (W)

  eacToday: number; // energy generated today (kWh)
  eacTotal: number; // lifetime energy generated (kWh)

  vac1: number; // grid voltage (V)
  fac: number; // grid frequency (Hz)
  temp1: number; // inverter temperature (°C)
  pf?: number; // power factor

  etoUserToday?: number; // daily energy from grid to user (kWh)
  etoGridToday?: number; // daily energy exported to grid today (kWh)

  // Battery fields — present on min devices with a BDC/BMS
  bdc1Vbat?: number; // battery voltage from BDC (V)
  bdc1Soc?: number; // battery SoC from BDC (%)
  bmsSOC?: number; // battery SoC from BMS (%)
  bmsVbat?: number; // battery voltage from BMS (V)
  echargeToday?: number; // battery charged today (kWh)
  edischargeToday?: number; // battery discharged today (kWh)
}

// ─── queryLastData — storage (hybrid/off-grid) ────────────────────────────────

export interface GrowattStorageData {
  serialNum: string;
  time: string; // "YYYY-MM-DD HH:mm:ss"
  status: number;
  statusText?: string;

  ppv: number; // total PV input power (W)
  ppv2?: number; // PV string 2 power (W) — present on dual-MPPT models
  vpv: number; // PV voltage (V)
  ipv?: number; // PV current (A)

  outPutPower: number; // AC output power to loads (W)
  outPutVolt: number; // AC output voltage (V)
  outPutCurrent?: number; // AC output current (A)
  freqOutPut: number; // AC output frequency (Hz)
  loadPercent?: number; // load percentage (%)

  vGrid?: number; // grid voltage (V) — 0 when off-grid
  freqGrid?: number; // grid frequency (Hz)

  vBat: number; // battery voltage (V)
  capacity: number; // battery SoC (%)
  pBat?: number; // battery power: negative = charging, positive = discharging (W)
  iChargePV1?: number; // PV charge current string 1 (A)
  iChargePV2?: number; // PV charge current string 2 (A)
  chgCurr?: number; // charge current (A)
  dischgCurr?: number; // discharge current (A)

  invTemperature?: number; // inverter temperature (°C)
  dcDcTemperature?: number;
  buck1_NTCTemperature?: number;
  buck2_NTCTemperature?: number;

  epvToday: number; // PV energy generated today (kWh)
  epvTotal: number; // PV energy generated total (kWh)

  eacChargeToday?: number; // AC charge energy today (kWh)
  eacChargeTotal?: number;
  eBatDisChargeToday?: number; // battery discharge energy today (kWh)
  eBatDisChargeTotal?: number;
  eacDisChargeToday?: number; // AC discharge energy today (kWh)
  eacDisChargeTotal?: number;

  eToGridToday?: number; // energy exported to grid today (kWh)
  eToGridTotal?: number;
  eToUserToday?: number; // energy imported from grid today (kWh)
  eToUserTotal?: number;

  eopDischrToday?: number; // total discharge energy today (kWh)
  eopDischrTotal?: number;

  pAcCharge?: number; // AC charge power (W)
  pAcInPut?: number; // AC input power (W)

  lost?: boolean;
  errorCode?: number;
  warnCode?: number;
}

// ─── queryLastData response ───────────────────────────────────────────────────

/**
 * POST /v4/new-api/queryLastData
 *
 * The `data` object contains either a `min` key (grid-tie) or a `storage` key
 * (hybrid/off-grid), depending on the `deviceType` sent in the request body.
 * Both are typed as optional so callers can check which one is present.
 */
export interface GrowattQueryLastDataResponse {
  code: number;
  message: string;
  data: {
    min?: GrowattMinData[];
    storage?: GrowattStorageData[];
  };
}
