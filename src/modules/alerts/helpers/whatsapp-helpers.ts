// ==================================================================
// WHATSAPP DELIVERY HELPERS — Pure Functions
// Formatting, validation, and truncation for WhatsApp messages.
// ==================================================================

export interface WhatsAppMessage {
  to: string;
  body: string;
  type: 'text' | 'template';
  templateName?: string;
}

export interface AlertForFormatting {
  type: string;
  severity: string;
  message: string;
  minutesUntilDepletion?: number;
}

/**
 * Format an alert into a WhatsApp-friendly message string.
 *
 * Format: {icon} Energy IQ Alert\nType: {type}\n{message}\nDepletion in: {min} min
 *
 * @param alert - Alert data to format
 * @returns Formatted message string
 */
export function formatAlertMessage(alert: AlertForFormatting): string {
  const severityIcon = alert.severity === 'critical' ? '🚨' : '⚠️';
  const depletionLine =
    alert.minutesUntilDepletion !== undefined
      ? `\n⏱ Estimated depletion in: ${Math.round(alert.minutesUntilDepletion)} min`
      : '';
  return `${severityIcon} Energy IQ Alert\nType: ${alert.type}\n${alert.message}${depletionLine}`;
}

/**
 * Truncate a message to fit within WhatsApp's character limit.
 *
 * @param body      - The message string to truncate
 * @param maxLength - Maximum allowed length (default: 4096)
 * @returns Truncated string ending with "..." if over limit
 */
export function truncateMessage(
  body: string,
  maxLength: number = 4096,
): string {
  if (body.length <= maxLength) return body;
  return body.substring(0, maxLength - 3) + '...';
}

/**
 * Validate a phone number for Nigerian WhatsApp format.
 *
 * Accepted formats:
 *   - International: +2348012345678
 *   - Local:         08012345678
 *
 * Must start with +234 or 0, followed by 7, 8, or 9,
 * then exactly 9 more digits.
 *
 * @param phone - Phone number string to validate
 * @returns true if valid Nigerian mobile number
 */
export function validatePhoneNumber(phone: string): boolean {
  const nigeriaRegex = /^(\+234|0)[789]\d{9}$/;
  return nigeriaRegex.test(phone);
}
