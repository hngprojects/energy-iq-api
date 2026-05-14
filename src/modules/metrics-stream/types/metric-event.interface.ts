/**
 * MetricEvent: SSE wire format sent to the browser.
 * Power values are converted from kW (internal) to W (wire).
 * All optional fields are null when not available from the brand API.
 */
export interface MetricEvent {
  inverter_id: string;
  recorded_at: string; // ISO 8601 UTC
  battery_soc: number | null;
  solar_power_w: number | null;
  ac_output_power_w: number | null;
  grid_voltage_v: number | null;
  grid_frequency_hz: number | null;
  inverter_status: string;
  battery_voltage_v: number | null;
  battery_current_a: number | null;
  battery_temperature_c: number | null;
  battery_time_to_go_min: number | null;
  inverter_temperature_c: number | null;
}
