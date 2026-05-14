export const QUEUES = {
  EMAIL: 'email',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
