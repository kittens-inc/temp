const MIN_DAYS = 30;
const MAX_DAYS = 365;
const MAX_SIZE = 512 * 1024 * 1024;

function calculateDays(fileSize: number): number {
  const ratio = fileSize / MAX_SIZE;
  return Math.floor(MIN_DAYS + (MIN_DAYS - MAX_DAYS) * Math.pow(ratio - 1, 3));
}

export function calculateRetention(fileSize: number): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + calculateDays(fileSize));
  return expiresAt;
}

export function getRetentionDays(fileSize: number): number {
  return calculateDays(fileSize);
}
