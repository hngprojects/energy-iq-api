export const QUEUES = {
  EMAIL: 'email',
  ALERT_DISPATCH: 'alert-dispatch',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
