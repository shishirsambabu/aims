export const DEFAULT_PAGE_SIZE = 50;

/** Parses a `?page=` URL value into a 1-based page number. */
export function parsePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** Prisma skip/take arguments for a 1-based page. */
export function pageArgs(page: number, pageSize: number = DEFAULT_PAGE_SIZE) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
