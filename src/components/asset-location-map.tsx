import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Graticule,
  Marker,
  Sphere,
} from "react-simple-maps";
import world from "world-atlas/countries-110m.json";

export type AssetLocationDatum = {
  location: string;
  total: number;
};

type LocatedDatum = AssetLocationDatum & {
  coordinates: [number, number];
};

const KNOWN_LOCATIONS: Array<{ aliases: string[]; coordinates: [number, number] }> = [
  { aliases: ["sao paulo", "sao paulo sp"], coordinates: [-46.6333, -23.5505] },
  { aliases: ["rio de janeiro", "rio de janeiro rj"], coordinates: [-43.1729, -22.9068] },
  { aliases: ["belo horizonte", "belo horizonte mg"], coordinates: [-43.9378, -19.9167] },
  { aliases: ["brasilia", "distrito federal", "df"], coordinates: [-47.8825, -15.7942] },
  { aliases: ["salvador", "salvador ba"], coordinates: [-38.5014, -12.973] },
  { aliases: ["fortaleza", "fortaleza ce"], coordinates: [-38.5267, -3.7319] },
  { aliases: ["recife", "recife pe"], coordinates: [-34.877, -8.0476] },
  { aliases: ["curitiba", "curitiba pr"], coordinates: [-49.2733, -25.4284] },
  { aliases: ["porto alegre", "porto alegre rs"], coordinates: [-51.2304, -30.0346] },
  { aliases: ["manaus", "manaus am"], coordinates: [-60.0217, -3.119] },
  { aliases: ["belem", "belem pa"], coordinates: [-48.4902, -1.4558] },
  { aliases: ["goiania", "goiania go"], coordinates: [-49.2643, -16.6869] },
  { aliases: ["vitoria", "vitoria es"], coordinates: [-40.3128, -20.3155] },
  { aliases: ["florianopolis", "florianopolis sc"], coordinates: [-48.5482, -27.5949] },
  { aliases: ["campo grande", "campo grande ms"], coordinates: [-54.6464, -20.4697] },
  { aliases: ["cuiaba", "cuiaba mt"], coordinates: [-56.0974, -15.6014] },
  { aliases: ["maceio", "maceio al"], coordinates: [-35.735, -9.6498] },
  { aliases: ["natal", "natal rn"], coordinates: [-35.2094, -5.7945] },
  { aliases: ["joao pessoa", "joao pessoa pb"], coordinates: [-34.861, -7.115] },
  { aliases: ["aracaju", "aracaju se"], coordinates: [-37.0731, -10.9472] },
  { aliases: ["teresina", "teresina pi"], coordinates: [-42.8019, -5.0892] },
  { aliases: ["sao luis", "sao luis ma"], coordinates: [-44.2829, -2.5307] },
  { aliases: ["palmas", "palmas to"], coordinates: [-48.3336, -10.184] },
  { aliases: ["rio branco", "rio branco ac"], coordinates: [-67.8243, -9.9754] },
  { aliases: ["porto velho", "porto velho ro"], coordinates: [-63.9039, -8.7608] },
  { aliases: ["boa vista", "boa vista rr"], coordinates: [-60.6753, 2.8235] },
  { aliases: ["macapa", "macapa ap"], coordinates: [-51.0664, 0.0349] },
  { aliases: ["brasil", "brazil"], coordinates: [-51.9253, -14.235] },
  { aliases: ["lisboa", "lisbon", "portugal"], coordinates: [-9.1393, 38.7223] },
  { aliases: ["nova york", "new york"], coordinates: [-74.006, 40.7128] },
  { aliases: ["miami"], coordinates: [-80.1918, 25.7617] },
  { aliases: ["londres", "london"], coordinates: [-0.1276, 51.5072] },
  { aliases: ["madri", "madrid"], coordinates: [-3.7038, 40.4168] },
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function locate(value: string): [number, number] | null {
  const normalized = normalize(value);
  const match = KNOWN_LOCATIONS.find(({ aliases }) =>
    aliases.some((alias) => normalized === alias || normalized.includes(` ${alias} `)),
  );
  return match?.coordinates ?? null;
}

export function AssetLocationMap({
  data,
  withoutLocation,
}: {
  data: AssetLocationDatum[];
  withoutLocation: number;
}) {
  const [active, setActive] = useState<LocatedDatum | null>(null);
  const { located, unresolved } = useMemo(() => {
    const points: LocatedDatum[] = [];
    let missing = withoutLocation;
    for (const item of data) {
      const coordinates = locate(item.location);
      if (coordinates) points.push({ ...item, coordinates });
      else missing += item.total;
    }
    return { located: points, unresolved: missing };
  }, [data, withoutLocation]);
  const max = Math.max(1, ...located.map((item) => item.total));

  return (
    <div>
      <div className="relative h-72 overflow-hidden rounded-md bg-muted/40 sm:h-80">
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ scale: 145 }}
          className="h-full w-full"
          aria-label="Mapa mundial com a distribuição dos equipamentos"
        >
          <Sphere id="asset-map-sphere" fill="var(--card)" stroke="var(--border)" strokeWidth={0.7} />
          <Graticule stroke="var(--border)" strokeWidth={0.35} />
          <Geographies geography={world}>
            {({ geographies }) =>
              geographies.map((geography) => (
                <Geography
                  key={geography.rsmKey}
                  geography={geography}
                  fill="var(--muted)"
                  stroke="var(--card)"
                  strokeWidth={0.55}
                  style={{
                    default: { outline: "none" },
                    hover: { fill: "var(--secondary)", outline: "none" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>
          {located.map((item) => {
            const radius = 4 + Math.sqrt(item.total / max) * 10;
            return (
              <Marker key={item.location} coordinates={item.coordinates}>
                <g
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.location}: ${item.total} equipamentos`}
                  onMouseEnter={() => setActive(item)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(item)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive((current) => (current?.location === item.location ? null : item))}
                  className="cursor-pointer outline-none"
                >
                  <circle r={radius + 4} fill="var(--primary)" opacity={0.16} />
                  <circle r={radius} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
                </g>
              </Marker>
            );
          })}
        </ComposableMap>

        {active && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-md border bg-popover px-3 py-2 shadow-[var(--shadow-elevated)]">
            <p className="text-xs font-semibold text-popover-foreground">{active.location}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {active.total} equipamento{active.total === 1 ? "" : "s"}
            </p>
          </div>
        )}

        {located.length === 0 && (
          <div className="absolute inset-x-4 bottom-4 rounded-md border bg-card/95 px-4 py-3 text-center shadow-[var(--shadow-card)]">
            <p className="text-sm font-medium">Nenhuma localização identificada</p>
            <p className="mt-1 text-xs text-muted-foreground">
              O mapa será preenchido quando os equipamentos receberem uma localidade.
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-primary" />
          O tamanho indica a quantidade de equipamentos
        </span>
        <span className="tabular-nums">
          {unresolved} sem localização identificável
        </span>
      </div>
    </div>
  );
}