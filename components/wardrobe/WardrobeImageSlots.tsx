import type { WardrobeImageAsset, WardrobeImagePurpose } from "@/types/ai-tagging";
import { Badge } from "@/components/ui/Badge";
import { ImageFrame } from "@/components/ui/ImageFrame";
import { cn } from "@/lib/utils";

const slotLabels: Array<{ key: WardrobeImagePurpose; label: string; helper: string }> = [
  { key: "front", label: "Front", helper: "Shape and color" },
  { key: "back", label: "Back", helper: "Fit and construction" },
  { key: "fabricCloseUp", label: "Fabric", helper: "Texture and pattern" },
  { key: "label", label: "Label", helper: "Size, care, brand" }
];

export function WardrobeImageSlots({
  images = {},
  onSelect,
  disabled = false
}: {
  images?: Partial<Record<WardrobeImagePurpose, WardrobeImageAsset>>;
  onSelect?: (purpose: WardrobeImagePurpose) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {slotLabels.map((slot) => {
        const image = images[slot.key];
        const studioStatus = image?.variants?.studio?.status;
        const displayUrl = image?.variants?.studio?.status === "ready" && image.variants.studio.url
          ? image.variants.studio.url
          : image?.variants?.cutout?.status === "ready" && image.variants.cutout.url
            ? image.variants.cutout.url
            : image?.url;
        return (
          <button
            key={slot.key}
            type="button"
            className={cn(
              "focus-ring group min-w-0 rounded-2xl text-left transition active:scale-[0.99]",
              disabled ? "cursor-not-allowed opacity-80" : "hover:-translate-y-0.5"
            )}
            onClick={() => onSelect?.(slot.key)}
            disabled={disabled || !onSelect}
            aria-label={`${slot.label} photo slot`}
          >
            <ImageFrame
              src={displayUrl}
              alt={`${slot.label} photo`}
              placeholder={
                <span>
                  <span className="block text-sm text-ink">{slot.label}</span>
                  <span className="mt-1 block text-[11px] font-medium text-muted">{slot.helper}</span>
                </span>
              }
              overlay={
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={image?.url ? "success" : "neutral"}>{image?.url ? "Added" : "Needed"}</Badge>
                  {studioStatus === "processing" ? <Badge tone="info">Studio</Badge> : null}
                  {studioStatus === "unavailable" ? <Badge tone="warning">Original</Badge> : null}
                  <span className="truncate rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-ink shadow-card">
                    {slot.label}
                  </span>
                </div>
              }
            />
          </button>
        );
      })}
    </div>
  );
}
