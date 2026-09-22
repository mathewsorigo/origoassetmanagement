import simbolo from "@/assets/origo-simbolo.png.asset.json";
import logoCompleto from "@/assets/origo-logo-completo.png.asset.json";
import { cn } from "@/lib/utils";

export function OrigoSimbolo({ className }: { className?: string }) {
  return (
    <img
      src={simbolo.url}
      alt="Órigo Asset Management"
      className={cn("size-9 object-contain", className)}
    />
  );
}

export function OrigoLogo({ className }: { className?: string }) {
  return (
    <img
      src={logoCompleto.url}
      alt="Órigo Asset Management"
      className={cn("h-10 w-auto object-contain", className)}
    />
  );
}
