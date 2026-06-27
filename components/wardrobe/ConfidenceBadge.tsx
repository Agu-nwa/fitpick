import { cn } from "@/lib/utils";

export function ConfidenceBadge({ confidence }: { confidence?: number }) {
  const value = typeof confidence === "number" ? Math.round(confidence * 100) : 0;
  const tone =
    value >= 80
      ? "border-success/30 bg-success/10 text-ink"
      : value >= 60
        ? "border-warning/30 bg-warning/10 text-ink"
        : "border-line bg-stone-50 text-muted";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold", tone)}>
      {value}% confidence
    </span>
  );
}
