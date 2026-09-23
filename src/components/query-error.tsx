import { Button } from "@/components/ui/button";

export function QueryError({ retry }: { retry: () => unknown }) {
  return (
    <div
      role="alert"
      className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
    >
      <div>
        <p className="font-medium">Não foi possível carregar os dados.</p>
        <p className="text-muted-foreground">Verifique sua conexão e tente novamente.</p>
      </div>
      <Button variant="outline" onClick={() => void retry()}>
        Tentar novamente
      </Button>
    </div>
  );
}
