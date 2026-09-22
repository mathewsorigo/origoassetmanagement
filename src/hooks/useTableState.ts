import { useEffect, useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

function compareValues(a: unknown, b: unknown): number {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return collator.compare(String(a), String(b));
}

export type Accessors<T> = Record<string, (row: T) => unknown>;

export function useTableState<T>(
  rows: T[] | undefined,
  options: {
    key: string;
    accessors: Accessors<T>;
    defaultSort?: { key: string; dir: SortDir };
    defaultPageSize?: number;
  },
) {
  const { key, accessors, defaultSort, defaultPageSize = 25 } = options;
  const storageKey = `table-page-size:${key}`;

  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(defaultSort ?? null);
  const [pageSize, setPageSizeState] = useState<number>(defaultPageSize);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = Number(window.localStorage.getItem(storageKey));
    if (PAGE_SIZE_OPTIONS.includes(stored as (typeof PAGE_SIZE_OPTIONS)[number])) {
      setPageSizeState(stored);
    }
  }, [storageKey]);

  const setPageSize = (value: number) => {
    setPageSizeState(value);
    setPage(1);
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, String(value));
  };

  const toggleSort = (columnKey: string) => {
    setPage(1);
    setSort((current) => {
      if (!current || current.key !== columnKey) return { key: columnKey, dir: "asc" };
      if (current.dir === "asc") return { key: columnKey, dir: "desc" };
      return defaultSort && defaultSort.key === columnKey ? defaultSort : null;
    });
  };

  const source = rows ?? [];

  const sorted = useMemo(() => {
    if (!sort) return source;
    const accessor = accessors[sort.key];
    if (!accessor) return source;
    const copy = [...source];
    copy.sort((a, b) => {
      const result = compareValues(accessor(a), accessor(b));
      return sort.dir === "asc" ? result : -result;
    });
    return copy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, sort]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const start = (currentPage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  return {
    sortKey: sort?.key ?? null,
    sortDir: sort?.dir ?? null,
    toggleSort,
    pageSize,
    setPageSize,
    page: currentPage,
    setPage,
    pageCount,
    pageRows,
    total,
    rangeStart: total === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, total),
    sortedRows: sorted,
  };
}
