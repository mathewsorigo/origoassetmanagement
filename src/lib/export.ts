import QRCode from "qrcode";

type Row = Record<string, unknown>;

export function exportToCsv(fileName: string, rows: Row[]) {
  const first = rows[0];
  const headers = first ? Object.keys(first) : [];
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [
    headers.map(escape).join(";"),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(";")),
  ].join("\r\n");

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export type QrItem = { title: string; subtitle?: string; value: string };

/** Abre uma folha imprimível com o QR Code de cada item. */
export async function openQrSheet(items: QrItem[], heading = "Etiquetas de equipamentos") {
  if (!items.length) return;
  const cards = await Promise.all(
    items.map(async (item) => {
      const dataUrl = await QRCode.toDataURL(item.value, { margin: 1, width: 240 });
      return `<figure class="card">
        <img src="${dataUrl}" alt="QR ${escapeHtml(item.title)}" />
        <figcaption>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.subtitle ?? "")}</span>
        </figcaption>
      </figure>`;
    }),
  );

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
    <title>${escapeHtml(heading)}</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 24px; color: #14212b; }
      h1 { font-size: 18px; margin-bottom: 16px; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
      .card { border: 1px solid #d8e0e4; border-radius: 12px; padding: 12px; margin: 0; text-align: center; break-inside: avoid; }
      .card img { width: 140px; height: 140px; }
      figcaption { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; font-size: 12px; }
      figcaption span { color: #607480; font-size: 11px; }
      @media print { body { margin: 8mm; } }
    </style></head>
    <body><h1>${escapeHtml(heading)}</h1><div class="grid">${cards.join("")}</div>
    <script>window.onload = () => window.print();</script>
    </body></html>`);
  win.document.close();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
