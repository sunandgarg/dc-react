export const GENERAL_RATING_FALLBACK = 4.9;
export const STUDENT_RATING_FALLBACK = 4.8;

export function displayRating(value: unknown, fallback = GENERAL_RATING_FALLBACK) {
  const rating = Number(value);
  return Number.isFinite(rating) && rating > 0 && rating <= 5 ? rating : fallback;
}
