export async function exportToExcel(fileName: string, rows: Array<Record<string, unknown>>) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Dados");
  XLSX.writeFile(book, `${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function readSpreadsheet(file: ArrayBuffer): Promise<Array<Record<string, unknown>>> {
  const XLSX = await import("xlsx");
  const book = XLSX.read(file, { type: "array", raw: true });
  const first = book.SheetNames[0];
  if (!first) return [];
  const sheet = book.Sheets[first];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}
