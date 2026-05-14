export interface GrowattPlant {
  plant_id: string;
  name: string;
  current_power: number; // kW: current output
  total_energy: number; // kWh: lifetime
  today_energy: number; // kWh: today
  peak_power: number; // kW: rated capacity
}

export interface GrowattPlantListResponse extends Partial<GrowattPlant> {
  error_code: number;
  error_msg?: string;
  count?: number;
  data?: GrowattPlant[]; // present if API wraps in array
}

export interface GrowattDevice {
  device_id: string;
  device_sn: string;
  datalogger_sn: string;
  model: string;
  type: number; // 1 = inverter, 2 = storage, 3 = other
  manufacturer: string;
}

export interface GrowattDeviceListResponse extends Partial<GrowattDevice> {
  error_code: number;
  count?: number;
  data?: GrowattDevice[]; // present if API wraps in array
}

interface GrowattMinData {
  serialNum: string;
  time: string; // "YYYY-MM-DD HH:mm:ss"
  status: number; // 0: waiting, 1: normal, 2: fault
  statusText: string;
  ppv: number; // total PV input power (W)
  ppv1: number; // PV string 1 power (W)
  ppv2: number; // PV string 2 power (W)
  pac: number; // AC output power to loads (W)
  eacToday: number; // energy generated today (kWh)
  eacTotal: number; // lifetime energy generated (kWh)
  vac1: number; // grid voltage (V)
  fac: number; // grid frequency (Hz)
  temp1: number; // inverter temperature (°C)
  pf: number; // power factor
  etoUserToday: number; // daily energy from grid to user (kWh)
  etoGridToday: number; // daily energy from user to grid (kWh)

  bdc1Vbat?: number; // battery voltage from BDC (V)
  bdc1Soc?: number; // battery SoC from BDC (%)
  bmsSOC?: number; // battery SoC from BMS (%)
  bmsVbat?: number; // battery voltage from BMS (V)
  echargeToday?: number; // battery charged today (kWh)
  edischargeToday?: number; // battery discharged today (kWh)
}

export interface GrowattQueryLastDataResponse {
  code: number;
  message: string;
  data: {
    min: GrowattMinData[];
  };
}
