/**
 * Business-day math in the organization's timezone (Asia/Kolkata).
 *
 * The app runs on UTC servers, but "due today", "expires in 30 days", and
 * free-day countdowns must flip at IST midnight, not 05:30 IST. IST has a
 * fixed +05:30 offset with no DST, so the arithmetic below is exact without
 * a timezone library.
 */

const IST_OFFSET_MINUTES = 330; // UTC+05:30, no DST
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/** Start of the current business day (IST midnight) as a UTC Date. */
export function startOfTodayIst(now: Date = new Date()): Date {
  const istMs = now.getTime() + IST_OFFSET_MINUTES * MS_PER_MINUTE;
  const istDayStartMs = Math.floor(istMs / MS_PER_DAY) * MS_PER_DAY;
  return new Date(istDayStartMs - IST_OFFSET_MINUTES * MS_PER_MINUTE);
}

/** End of the current business day (last ms before next IST midnight). */
export function endOfTodayIst(now: Date = new Date()): Date {
  return new Date(startOfTodayIst(now).getTime() + MS_PER_DAY - 1);
}

/** IST-midnight boundary `days` from today (e.g. +30 for expiry windows). */
export function istDayBoundary(days: number, now: Date = new Date()): Date {
  return new Date(startOfTodayIst(now).getTime() + days * MS_PER_DAY);
}

/**
 * Whole business days between the IST day containing `date` and today.
 * Positive = date is in the past (overdue by N days), negative = upcoming.
 */
export function istDaysOverdue(date: Date, now: Date = new Date()): number {
  const dayOf = startOfTodayIst(date).getTime();
  const today = startOfTodayIst(now).getTime();
  return Math.round((today - dayOf) / MS_PER_DAY);
}
