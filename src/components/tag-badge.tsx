import { cn } from "@/lib/utils";
import { tagTone, type Tag } from "@/lib/tags";

export function TagBadge({ tag, className }: { tag: Tag; className?: string }) {
  const tone = tagTone(tag.color);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone.className,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} />
      {tag.name}
    </span>
  );
}
