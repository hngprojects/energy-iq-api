// src/modules/alerts/delivery/fallback.service.ts
// ==================================================================
// DELIVERY FALLBACK SERVICE — Channel fallback with audit trail
// ==================================================================

export interface AlertDelivery {
  alertId: string;
  userId: string;
  message: string;
  channels: string[]; // ordered fallback chain
  userSettings: {
    whatsappAlerts: boolean;
    emailAlerts: boolean;
    smsNotification: boolean;
  };
}

export type DeliveryStatus = 'delivered' | 'failed' | 'partial_success';

export interface DeliveryResult {
  status: DeliveryStatus;
  channelUsed: string | null;
  audit: string[];
}

/**
 * Attempt delivery across a prioritized channel chain.
 *
 * Rules:
 *   - Each channel attempted exactly once (no infinite loops)
 *   - Respects user channel preferences (skips disabled channels)
 *   - If all channels fail → status = 'failed'
 *   - If some succeed after fallback → status = 'delivered'
 *   - Audit log for each attempt: "{channel}: {result}"
 *
 * @param delivery - The alert delivery payload with channel chain
 * @param channelServices - Object mapping channel names to { send: Function }
 * @returns DeliveryResult with status, channel used, and audit trail
 */
export async function deliverWithFallback(
  delivery: AlertDelivery,
  channelServices: Record<string, { send: Function }>,
): Promise<DeliveryResult> {
  const audit: string[] = [];
  let lastError: string | null = null;

  for (const channel of delivery.channels) {
    // Check user preference
    if (
      (channel === 'whatsapp' && !delivery.userSettings.whatsappAlerts) ||
      (channel === 'email' && !delivery.userSettings.emailAlerts) ||
      (channel === 'sms' && !delivery.userSettings.smsNotification)
    ) {
      audit.push(`${channel}: skipped (user disabled)`);
      continue;
    }

    try {
      const service = channelServices[channel];
      await service.send({ to: delivery.userId, message: delivery.message });
      audit.push(`${channel}: delivered`);
      return { status: 'delivered', channelUsed: channel, audit };
    } catch (err) {
      lastError = (err as Error).message;
      audit.push(`${channel}: failed - ${lastError}`);
      // continue to next channel
    }
  }

  return {
    status: lastError ? 'failed' : 'partial_success',
    channelUsed: null,
    audit,
  };
}