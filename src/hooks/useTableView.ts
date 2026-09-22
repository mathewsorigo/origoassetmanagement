import { useCallback, useEffect, useState } from "react";

export type ColumnDef = { id: string; label: string; locked?: boolean };

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignora */
  }
}

/** Alterna entre visão em tabela e em cartões, guardando a escolha. */
export function useViewMode(key: string, initial: "table" | "cards" = "table") {
  const storageKey = `table-view-mode:${key}`;
  const [mode, setMode] = useState<"table" | "cards">(initial);

  useEffect(() => {
    setMode(read<"table" | "cards">(storageKey, initial));
  }, [storageKey, initial]);

  const update = useCallback(
    (next: "table" | "cards") => {
      setMode(next);
      write(storageKey, next);
    },
    [storageKey],
  );

  return { mode, setMode: update };
}

/** Colunas visíveis por tela, guardadas no navegador. */
export function useColumns(key: string, columns: ColumnDef[]) {
  const storageKey = `table-columns:${key}`;
  const all = columns.map((c) => c.id);
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    setHidden(read<string[]>(storageKey, []));
  }, [storageKey]);

  const toggle = useCallback(
    (id: string) => {
      setHidden((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        write(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const reset = useCallback(() => {
    setHidden([]);
    write(storageKey, []);
  }, [storageKey]);

  const isVisible = useCallback(
    (id: string) => {
      const def = columns.find((c) => c.id === id);
      if (def?.locked) return true;
      return !hidden.includes(id);
    },
    [hidden, columns],
  );

  return { columns, all, hidden, toggle, reset, isVisible };
}

export type SavedView = { name: string; filters: Record<string, string> };

/** Conjuntos de filtros nomeados, guardados no navegador. */
export function useSavedViews(key: string) {
  const storageKey = `table-saved-views:${key}`;
  const [views, setViews] = useState<SavedView[]>([]);

  useEffect(() => {
    setViews(read<SavedView[]>(storageKey, []));
  }, [storageKey]);

  const save = useCallback(
    (name: string, filters: Record<string, string>) => {
      setViews((prev) => {
        const next = [...prev.filter((v) => v.name !== name), { name, filters }].sort((a, b) =>
          a.name.localeCompare(b.name, "pt-BR"),
        );
        write(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const remove = useCallback(
    (name: string) => {
      setViews((prev) => {
        const next = prev.filter((v) => v.name !== name);
        write(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  return { views, save, remove };
}
