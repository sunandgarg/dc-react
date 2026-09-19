export type PaginationItem = number | "ellipsis-start" | "ellipsis-end";

export function normalizePage(value: unknown, totalPages = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  const page = Number.isFinite(parsed) ? parsed : 1;
  return Math.min(Math.max(1, page), Math.max(1, Math.floor(totalPages)));
}

export function paginationItems(currentPage: number, totalPages: number, siblingCount = 1): PaginationItem[] {
  const total = Math.max(1, Math.floor(totalPages));
  const current = normalizePage(currentPage, total);
  const siblings = Math.max(0, Math.floor(siblingCount));
  const visibleSlots = siblings * 2 + 5;

  if (total <= visibleSlots) return Array.from({ length: total }, (_, index) => index + 1);

  const left = Math.max(2, current - siblings);
  const right = Math.min(total - 1, current + siblings);
  const showLeftEllipsis = left > 2;
  const showRightEllipsis = right < total - 1;

  if (!showLeftEllipsis) {
    const end = Math.min(total - 1, 3 + siblings * 2);
    return [
      1,
      ...Array.from({ length: end - 1 }, (_, index) => index + 2),
      "ellipsis-end",
      total,
    ];
  }

  if (!showRightEllipsis) {
    const start = Math.max(2, total - (2 + siblings * 2));
    return [
      1,
      "ellipsis-start",
      ...Array.from({ length: total - start }, (_, index) => start + index),
      total,
    ];
  }

  return [
    1,
    "ellipsis-start",
    ...Array.from({ length: right - left + 1 }, (_, index) => left + index),
    "ellipsis-end",
    total,
  ];
}
