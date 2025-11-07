/**
 * Date utilities for Tunisian timezone (Africa/Tunis)
 * Tunisia uses UTC+1 (CET) and UTC+2 (CEST) during daylight saving time
 */

const TUNISIA_TIMEZONE = 'Africa/Tunis';

/**
 * Get the current date/time in Tunisian timezone
 * @returns Date object representing current time in Tunisia
 */
export function getNowInTunisia(): Date {
  // Get current UTC time
  const now = new Date();
  // Get the date components in Tunisian timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TUNISIA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')!.value);
  const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1; // 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day')!.value);
  const hour = parseInt(parts.find(p => p.type === 'hour')!.value);
  const minute = parseInt(parts.find(p => p.type === 'minute')!.value);
  const second = parseInt(parts.find(p => p.type === 'second')!.value);
  
  // Create a date object with these components (in local timezone, but represents Tunisian time)
  return new Date(year, month, day, hour, minute, second);
}

/**
 * Get today's date in Tunisian timezone as YYYY-MM-DD string
 * @returns Date string in format YYYY-MM-DD
 */
export function getTodayInTunisia(): string {
  const now = getNowInTunisia();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current ISO string in Tunisian timezone
 * @returns ISO string of current time in Tunisia
 */
export function getNowISOInTunisia(): string {
  return getNowInTunisia().toISOString();
}

/**
 * Convert a date to Tunisian timezone
 * @param date - Date to convert
 * @returns Date object with components representing Tunisian timezone
 */
export function toTunisiaTime(date: Date): Date {
  // Get the date components in Tunisian timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TUNISIA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year')!.value);
  const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1; // 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day')!.value);
  const hour = parseInt(parts.find(p => p.type === 'hour')!.value);
  const minute = parseInt(parts.find(p => p.type === 'minute')!.value);
  const second = parseInt(parts.find(p => p.type === 'second')!.value);
  
  // Create a date object with these components
  return new Date(year, month, day, hour, minute, second);
}

/**
 * Format a date string to YYYY-MM-DD in Tunisian timezone
 * @param date - Date object or ISO string
 * @returns Date string in format YYYY-MM-DD
 */
export function formatDateForInput(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const tunisiaDate = toTunisiaTime(dateObj);
  const year = tunisiaDate.getFullYear();
  const month = String(tunisiaDate.getMonth() + 1).padStart(2, '0');
  const day = String(tunisiaDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get start of day in Tunisian timezone
 * @param date - Optional date, defaults to today
 * @returns Date object at start of day in Tunisia
 */
export function getStartOfDayInTunisia(date?: Date): Date {
  const targetDate = date ? toTunisiaTime(date) : getNowInTunisia();
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const day = targetDate.getDate();
  return new Date(year, month, day, 0, 0, 0, 0);
}

/**
 * Check if a date is today in Tunisian timezone
 * @param date - Date to check
 * @returns True if the date is today in Tunisia
 */
export function isTodayInTunisia(date: Date): boolean {
  const today = getNowInTunisia();
  const checkDate = toTunisiaTime(date);
  return (
    today.getFullYear() === checkDate.getFullYear() &&
    today.getMonth() === checkDate.getMonth() &&
    today.getDate() === checkDate.getDate()
  );
}

/**
 * Add days to a date in Tunisian timezone
 * @param date - Base date
 * @param days - Number of days to add
 * @returns New date with days added
 */
export function addDaysInTunisia(date: Date, days: number): Date {
  const tunisiaDate = toTunisiaTime(date);
  const newDate = new Date(tunisiaDate);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}

/**
 * Add months to a date in Tunisian timezone
 * @param date - Base date
 * @param months - Number of months to add
 * @returns New date with months added
 */
export function addMonthsInTunisia(date: Date, months: number): Date {
  const tunisiaDate = toTunisiaTime(date);
  const newDate = new Date(tunisiaDate);
  newDate.setMonth(newDate.getMonth() + months);
  return newDate;
}

