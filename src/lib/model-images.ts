import probook440 from "@/assets/models/hp-probook-440.jpg";
import probook640 from "@/assets/models/hp-probook-640.jpg";
import hp250 from "@/assets/models/hp-250.jpg";
import elitebook from "@/assets/models/hp-elitebook.jpg";
import zbook from "@/assets/models/hp-zbook.jpg";
import monitor24 from "@/assets/models/hp-monitor-24.jpg";
import monitor27 from "@/assets/models/hp-monitor-27.jpg";
import aocMonitor from "@/assets/models/aoc-monitor.jpg";
import elitedesk from "@/assets/models/hp-elitedesk.jpg";
import macbook14 from "@/assets/models/macbook-pro-14.jpg";

/** Foto de referência por família de modelo, para diferenciar visualmente os equipamentos. */
export function modelImage(model?: string | null): string | undefined {
  if (!model) return undefined;
  const m = model.toUpperCase();

  if (m.includes("MACBOOK")) return macbook14;
  if (m.includes("AOC")) return aocMonitor;
  if (m.includes("ELITEDESK")) return elitedesk;
  if (m.includes("E27")) return monitor27;
  if (m.includes("P24A") || m.includes("MONITOR")) return monitor24;
  if (m.includes("ZB") || m.includes("ZBOOK") || m.includes("FURY")) return zbook;
  if (m.includes("ELITEBK") || m.includes("ELITEBOOK") || m.includes("1040")) return elitebook;
  if (m.includes("640") || m.includes("830") || m.includes("840") || m.includes("820"))
    return probook640;
  if (m.includes("440")) return probook440;
  if (m.includes("240") || m.includes("250")) return hp250;
  return undefined;
}
