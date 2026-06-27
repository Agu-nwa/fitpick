import type { WardrobeItem } from "@/types/wardrobe";
import { Badge } from "@/components/ui/Badge";
import { ImageFrame } from "@/components/ui/ImageFrame";
import { cn } from "@/lib/utils";

export function WardrobeItemCard({ item }: { item: WardrobeItem }) {
  const status = item.condition === "needs-care" ? "Needs care" : item.condition === "missing-tags" ? "Missing tags" : "Ready";
  const tone = item.condition === "ready" ? "success" : item.condition === "needs-care" ? "warning" : "premium";
  const imageTone = item.imageTone || "from-stone-100 to-stone-300";
  const imageUrl = item.studioImageUrl || item.thumbnailUrl || item.imageUrl;
  const processingStatus = item.imageProcessingStatus || "not_started";

  return (
    <article className="h-full rounded-xl3 border border-line bg-surface p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft">
      <ImageFrame
        src={imageUrl}
        alt={item.name}
        aspect="portrait"
        className={cn("mb-3 border-0", imageUrl ? "" : imageTone)}
        placeholder={item.category}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-ink">{item.name}</h3>
          <p className="mt-1 text-xs text-muted">{item.color}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone={tone}>{status}</Badge>
        {item.recognizedEntity ? <Badge tone="premium">{item.recognizedEntity}</Badge> : null}
        {item.category ? <Badge>{item.category}</Badge> : null}
        {processingStatus === "processing" ? <Badge tone="info">Creating studio image</Badge> : null}
        {processingStatus === "unavailable" ? <Badge tone="warning">Studio image unavailable</Badge> : null}
      </div>
    </article>
  );
}
