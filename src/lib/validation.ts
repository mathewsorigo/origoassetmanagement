export function parseMoney(value: string | number | null | undefined): number | null {
  if (value == null || String(value).trim() === "") return null;
  const raw = String(value)
    .trim()
    .replace(/^R\$\s*/, "")
    .replace(/\s/g, "");
  if (
    !/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(raw) &&
    !/^-?\d+(?:\.\d{1,2})?$/.test(raw)
  )
    throw new Error("Informe um valor válido, por exemplo 1.234,56.");
  const n = Number(
    raw.includes(",")
      ? raw.replace(/\./g, "").replace(",", ".")
      : /^-?\d{1,3}(?:\.\d{3})+$/.test(raw)
        ? raw.replace(/\./g, "")
        : raw,
  );
  if (!Number.isFinite(n) || n < 0) throw new Error("O valor não pode ser negativo.");
  return n;
}

export function calendarDate(value: string): string | null {
  if (!value.trim()) return null;
  let iso = value.trim();
  const br = iso.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) iso = `${br[3]}-${br[2]}-${br[1]}`;
  else if (/^\d+(\.\d+)?$/.test(iso) && Number(iso) > 20000) {
    iso = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(iso)) * 86400000)
      .toISOString()
      .slice(0, 10);
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(iso) ||
    new Date(iso + "T12:00:00Z").toISOString().slice(0, 10) !== iso
  )
    throw new Error(`Data inválida: ${value}. Use dd/mm/aaaa.`);
  return iso;
}

export function validatePeriod(start: string | null | undefined, end: string | null | undefined) {
  const a = calendarDate(start ?? ""),
    b = calendarDate(end ?? "");
  if (a && b && a > b) throw new Error("O fim da locação deve ser igual ou posterior ao início.");
}
