const MIN_DAYS = 30;
const MAX_DAYS = 365;
const MAX_SIZE = 512 * 1024 * 1024;

export function calculateRetention(fileSize: number): Date {
  const ratio = fileSize / MAX_SIZE;
  const days = Math.floor(MIN_DAYS + (MAX_DAYS - MIN_DAYS) * Math.pow(1 - ratio, 2));
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + Math.min(MAX_DAYS, Math.max(MIN_DAYS, days)));
  return expiresAt;
}

export function getRetentionDays(fileSize: number): number {
  const ratio = fileSize / MAX_SIZE;
  return Math.floor(MIN_DAYS + (MAX_DAYS - MIN_DAYS) * Math.pow(1 - ratio, 2));
}
