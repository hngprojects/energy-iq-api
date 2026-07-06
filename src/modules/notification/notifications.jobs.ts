export const PUSH_JOBS = {
  SEND_PUSH: 'send-push',
} as const;

export interface SendPushJobData {
  notificationId: string; // to update pushDeliveryStatus after
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export type NotificationJobData = SendPushJobData;
