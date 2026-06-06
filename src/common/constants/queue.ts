export const QUEUES = {
  EMAIL: 'email',
  ALERT_DISPATCH: 'alert-dispatch',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const INVERTER_CONTROL_CHANNEL = 'inverter:control' as const;

export type InverterControlEvent = 'registered' | 'deregistered';

export interface InverterControlMessage {
  event: InverterControlEvent;
  inverterId: string;
  brand: string;
}
