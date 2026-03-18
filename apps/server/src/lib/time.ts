export type TimeInput = Date | string | number;

export function toDate(value: TimeInput): Date {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

export function toEpochMs(value: TimeInput): number {
  return toDate(value).getTime();
}

export function toIsoString(value: TimeInput): string {
  return toDate(value).toISOString();
}

export function addMilliseconds(value: TimeInput, milliseconds: number): Date {
  return new Date(toEpochMs(value) + milliseconds);
}
