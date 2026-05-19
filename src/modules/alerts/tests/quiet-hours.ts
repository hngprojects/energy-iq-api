// ==================================================================
// QUIET HOURS HELPERS — Pure Functions
// Determines if current time falls within user-defined quiet windows.
// ==================================================================

/**
 * Convert a local time string + timezone offset to UTC time string.
 *
 * Example: ('22:00', '+01:00') → '21:00'
 *
 * @param localTime - Time in "HH:mm" format (user's local time)
 * @param offset   - Timezone offset string e.g. "+01:00" or "-05:00"
 * @returns Equivalent UTC time in "HH:mm" format
 */
export function convertToUTC(localTime: string, offset: string): string {
  const [hours, mins] = localTime.split(':').map(Number);
  const sign = offset.startsWith('-') ? -1 : 1;
  const [offH, offM] = offset.slice(1).split(':').map(Number);
  const totalLocal = hours * 60 + mins;
  const totalOffset = sign * (offH * 60 + offM);
  let totalUtc = totalLocal - totalOffset;
  totalUtc = ((totalUtc % 1440 % 1440) + 1440) % 1440;
  const utcHours = Math.floor(totalUtc / 60);
  const utcMins = totalUtc % 60;
  return `${String(utcHours).padStart(2, '0')}:${String(utcMins).padStart(2, '0')}`;
}

/**
 * Determine if the current (UTC) time falls within a quiet hours window.
 *
 * Supports:
 *   - Midnight-spanning ranges: 22:00–06:00 (uses OR logic)
 *   - Same-day ranges: 09:00–17:00 (uses AND logic)
 *   - Sentinel 00:00–00:00 = always quiet
 *   - Exclusive end boundary (07:00 means *until* 07:00, not including)
 *
 * @param currentTime - Current UTC Date
 * @param quietStart  - Quiet hours start "HH:mm" in UTC
 * @param quietEnd    - Quiet hours end "HH:mm" in UTC
 * @returns true if current time is within quiet hours
 */
export function isWithinQuietHours(
  currentTime: Date,
  quietStart: string,
  quietEnd: string,
): boolean {
  const currentMinutes =
    currentTime.getUTCHours() * 60 + currentTime.getUTCMinutes();

  const [startH, startM] = quietStart.split(':').map(Number);
  const [endH, endM] = quietEnd.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Sentinel: 00:00–00:00 = always quiet
  if (quietStart === '00:00' && quietEnd === '00:00') return true;
  // Non-sentinel zero-length window = not quiet
  if (startMinutes === endMinutes) return false;

  // Midnight-spanning: start > end (e.g., 22:00–06:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  // Same-day: start < end (e.g., 09:00–17:00)
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}