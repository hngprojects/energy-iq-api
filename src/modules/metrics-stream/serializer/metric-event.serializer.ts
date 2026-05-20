import { NormalisedMetric } from '../../inverters/types/shared.types';
import { MetricEvent } from '../types/metric-event.interface';

/**
 * Converts an internal NormalisedMetric (kW, nullable fields) to the SSE wire format.
 * Power values are converted from kW → W. Null values are preserved as null.
 */
export function toMetricEvent(metric: NormalisedMetric): MetricEvent {
  const kwToW = (kw: number | null): number | null =>
    kw != null ? parseFloat((kw * 1000).toFixed(2)) : null;

  return {
    inverter_id: metric.inverterId,
    recorded_at: metric.recordedAt,
    battery_soc: metric.batterySoc,
    solar_power_w: kwToW(metric.solarPowerKw),
    ac_output_power_w: kwToW(metric.acOutputPowerKw),
    grid_voltage_v: metric.gridVoltageV,
    grid_frequency_hz: metric.gridFrequencyHz,
    inverter_status: metric.inverterStatus,
    battery_voltage_v: metric.batteryVoltageV,
    battery_current_a: metric.batteryCurrentA,
    battery_temperature_c: metric.batteryTemperatureC,
    battery_time_to_go_min: metric.batteryTimeToGoMin,
    inverter_temperature_c: metric.inverterTemperatureC,
  };
}
