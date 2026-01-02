export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function parseDate(dateStr: string): Date {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return date;
}

export function getToday(): string {
  return formatDate(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

export function getDaysBetween(startStr: string, endStr: string): string[] {
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  const days: string[] = [];

  const current = new Date(start);
  while (current <= end) {
    days.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}
