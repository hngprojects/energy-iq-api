export const ALERT_DISPATCH_JOB = 'alert.dispatch';
export const ALERT_DEFERRED_DELIVERY_JOB = 'alert.deferred-delivery';

export interface AlertDispatchJobData {
  alertId: string;
  userId: string;
  type: string;
  severity: string;
  message: string;
  channel: string; // primary channel (e.g., 'whatsapp')
  channels?: string[]; // fallback chain (optional)
}

export interface AlertDeferredDeliveryJobData {
  alertId: string;
  userId: string;
  scheduledFor: string; // ISO date string when quiet hours end
}
