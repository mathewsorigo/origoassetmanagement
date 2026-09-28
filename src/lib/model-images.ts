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
import dellG155511 from "@/assets/models/dell-g15-5511.jpg";
import dellG155520 from "@/assets/models/dell-g15-5520.jpg";
import dellVostro3400 from "@/assets/models/dell-vostro-3400.jpg";
import dellVostro3401 from "@/assets/models/dell-vostro-3401.jpg";
import dellVostro3500 from "@/assets/models/dell-vostro-3500.jpg";
import dellVostro3510 from "@/assets/models/dell-vostro-3510.jpg";
import dellVostro3515 from "@/assets/models/dell-vostro-3515.jpg";
import dellVostro3520 from "@/assets/models/dell-vostro-3520.jpg";
import dellVostro3525 from "@/assets/models/dell-vostro-3525.jpg";
import dellVostro5490 from "@/assets/models/dell-vostro-5490.jpg";
import dellVostro5510 from "@/assets/models/dell-vostro-5510.jpg";

/** Foto de referência por família de modelo, para diferenciar visualmente os equipamentos. */
export function modelImage(model?: string | null): string | undefined {
  if (!model) return undefined;
  const m = model.toUpperCase();

  if (m.includes("G15 5511") || m.includes("G5 15 5511")) return dellG155511;
  if (m.includes("G15 5520")) return dellG155520;
  if (m.includes("VOSTRO 15 3510") || m.includes("VOSTRO 3510")) return dellVostro3510;
  if (m.includes("VOSTRO 15 3515") || m.includes("VOSTRO 3515")) return dellVostro3515;
  if (m.includes("VOSTRO 15 5510") || m.includes("VOSTRO 5510")) return dellVostro5510;
  if (m.includes("VOSTRO 3400")) return dellVostro3400;
  if (m.includes("VOSTRO 3401")) return dellVostro3401;
  if (m.includes("VOSTRO 3500")) return dellVostro3500;
  if (m.includes("VOSTRO 3520")) return dellVostro3520;
  if (m.includes("VOSTRO 3525")) return dellVostro3525;
  if (m.includes("VOSTRO 5490")) return dellVostro5490;
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
