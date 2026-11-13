const pad = (n: number) => String(n).padStart(2, '0');

/** "17:30" → 1050 minutes since midnight; anything else → null. */
export function parseTimeInput(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** 1050 → "17:30" for a `type="time"` input; null → "". */
export function toTimeInput(minutes: number | null): string {
  return minutes === null ? '' : `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
}
