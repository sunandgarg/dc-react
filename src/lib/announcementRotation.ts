export const DEFAULT_ANNOUNCEMENT_ROTATION_SECONDS = 2.2;
export const MIN_ANNOUNCEMENT_ROTATION_SECONDS = 0.1;
export const MAX_ANNOUNCEMENT_ROTATION_SECONDS = 1000;

export function normalizeAnnouncementRotation(value: unknown): number {
  const parsed = Number(value);
  const seconds = Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_ANNOUNCEMENT_ROTATION_SECONDS;
  const clamped = Math.min(
    MAX_ANNOUNCEMENT_ROTATION_SECONDS,
    Math.max(MIN_ANNOUNCEMENT_ROTATION_SECONDS, seconds),
  );
  return Math.round(clamped * 10) / 10;
}

export function circularAnnouncementIndex(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return ((index + delta) % count + count) % count;
}
