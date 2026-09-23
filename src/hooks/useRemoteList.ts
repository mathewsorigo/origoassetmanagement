import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { PAGE_SIZE_OPTIONS, type SortDir } from "./useTableState";

type View =
  | "assets_list"
  | "employees_list"
  | "assignments_list"
  | "agreements_list"
  | "inventory_sessions_list"
  | "audit_list";
type Row<V extends View> = Database["public"]["Views"][V]["Row"];
type Options<V extends View> = {
  view: V;
  key: string;
  term: string;
  columns: Record<string, string>;
  defaultSort: string;
  defaultSortDir?: SortDir;
  filters?: Record<string, string>;
  archived?: boolean;
  textFilters?: Record<string, string>;
  ranges?: Record<string, { gte?: string; lte?: string }>;
};

export function useRemoteList<V extends View>(options: Options<V>) {
  const { view, key, term, columns, defaultSort, filters = {}, archived } = options;
  const [search, setSearch] = useState(term);
  const [pageSize, setSize] = useState(25);
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({
    key: defaultSort,
    dir: options.defaultSortDir ?? "asc",
  });
  useEffect(() => {
    const timer = setTimeout(() => setSearch(term), 250);
    return () => clearTimeout(timer);
  }, [term]);
  useEffect(() => {
    const value = Number(localStorage.getItem(`table-page-size:${key}`));
    if (PAGE_SIZE_OPTIONS.includes(value as 25)) setSize(value);
  }, [key]);
  const signature = JSON.stringify([
    search,
    filters,
    archived,
    sort,
    pageSize,
    options.ranges,
    options.textFilters,
  ]);
  const [position, setPosition] = useState({ signature, page: 1 });
  const page = position.signature === signature ? position.page : 1;
  const setPage = (next: number) => setPosition({ signature, page: next });

  function request(from: number, size: number) {
    let query = supabase.from(view).select("*", { count: "exact" });
    if (archived !== undefined)
      query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
    for (const [column, value] of Object.entries(filters)) {
      if (value)
        query =
          column === "tag_ids"
            ? query.contains(column, [value])
            : query.filter(column, "eq", value);
    }
    for (const [column, bounds] of Object.entries(options.ranges ?? {})) {
      if (bounds.gte) query = query.filter(column, "gte", bounds.gte);
      if (bounds.lte) query = query.filter(column, "lte", bounds.lte);
    }
    for (const [column, value] of Object.entries(options.textFilters ?? {})) {
      if (value.trim())
        query = query.ilike(column, "%" + value.replace(/[\\%_]/g, (c) => "\\" + c) + "%");
    }
    const normalized = search
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
    if (normalized)
      query = query.ilike("search_text", `%${normalized.replace(/[\\%_]/g, "\\$&")}%`);
    return query
      .order(columns[sort.key] ?? defaultSort, { ascending: sort.dir === "asc", nullsFirst: false })
      .order("id")
      .range(from, from + size - 1);
  }

  const query = useQuery({
    queryKey: [key, signature, page],
    queryFn: async () => {
      const { data, count, error } = await request((page - 1) * pageSize, pageSize);
      if (error) throw error;
      return { rows: data as unknown as Row<V>[], total: count ?? 0 };
    },
  });
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (query.data && page > pageCount) setPosition({ signature, page: pageCount });
  }, [query.data, page, pageCount, signature]);
  async function loadAll() {
    const result: Row<V>[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await request(from, 1000);
      if (error) throw error;
      result.push(...(data as unknown as Row<V>[]));
      if (data.length < 1000) return result;
    }
  }
  const rows = query.data?.rows ?? [];
  return {
    ...query,
    rows,
    loadAll,
    signature,
    table: {
      total,
      page,
      pageCount,
      pageSize,
      pageRows: rows,
      rangeStart: total ? (page - 1) * pageSize + 1 : 0,
      rangeEnd: Math.min(page * pageSize, total),
      setPage,
      setPageSize: (size: number) => {
        setSize(size);
        localStorage.setItem(`table-page-size:${key}`, String(size));
      },
      sortKey: sort.key,
      sortDir: sort.dir,
      toggleSort: (column: string) => {
        if (columns[column])
          setSort({ key: column, dir: sort.key === column && sort.dir === "asc" ? "desc" : "asc" });
      },
    },
  };
}
