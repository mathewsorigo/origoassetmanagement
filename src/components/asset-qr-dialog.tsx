import { useEffect, useState } from "react";
import { QrCode, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { openQrSheet } from "@/lib/export";
import { cn } from "@/lib/utils";

export type QrAsset = {
  id: string;
  serial_number: string;
  brand?: string | null;
  model?: string | null;
  patrimony?: string | null;
};

function labelOf(asset: QrAsset) {
  const title = `${asset.brand ?? ""} ${asset.model ?? ""}`.trim() || asset.serial_number;
  const subtitle = `Série ${asset.serial_number}${asset.patrimony ? ` · Pat. ${asset.patrimony}` : ""}`;
  return { title, subtitle };
}

export function AssetQrButton({
  asset,
  className,
  variant = "outline",
  size = "default",
}: {
  asset: QrAsset;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const { title, subtitle } = labelOf(asset);
  const value =
    typeof window === "undefined" ? `/qr/${asset.id}` : `${window.location.origin}/qr/${asset.id}`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDataUrl(null);
    (async () => {
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(value, { margin: 1, width: 480 });
      if (!cancelled) setDataUrl(url);
    })().catch(() => setDataUrl(null));
    return () => {
      cancelled = true;
    };
  }, [open, value]);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn(className)}
        onClick={() => setOpen(true)}
      >
        <QrCode className="mr-2 size-4 shrink-0" /> Ver QR Code
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code do equipamento</DialogTitle>
            <DialogDescription>
              Ao ler com a câmera do celular, o analista abre a tela de baixa deste equipamento.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3 py-2">
            {dataUrl ? (
              <img
                src={dataUrl}
                alt={`QR Code de ${title}`}
                className="aspect-square w-full max-w-56 rounded-md bg-white"
              />
            ) : (
              <Skeleton className="aspect-square w-full max-w-56 rounded-md" />
            )}
            <div className="text-center">
              <p className="break-words text-sm font-medium">{title}</p>
              <p className="break-all text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>

          <DialogFooter className="sm:justify-center">
            <Button
              variant="secondary"
              className="h-11 w-full sm:h-10 sm:w-auto"
              onClick={() => void openQrSheet([{ title, subtitle, value }], "Etiqueta do equipamento")}
            >
              <Printer className="mr-2 size-4" /> Imprimir etiqueta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
