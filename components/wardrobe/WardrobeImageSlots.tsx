import type { WardrobeImageAsset, WardrobeImagePurpose } from "@/types/ai-tagging";
import { cn } from "@/lib/utils";

const slotLabels: Array<{ key: WardrobeImagePurpose; label: string }> = [
  { key: "front", label: "Front" },
  { key: "back", label: "Back" },
  { key: "fabricCloseUp", label: "Fabric" },
  { key: "label", label: "Label" }
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
    <div className="grid grid-cols-4 gap-2">
      {slotLabels.map((slot) => {
        const image = images[slot.key];
        return (
          <button
            key={slot.key}
            type="button"
            className={cn(
              "focus-ring aspect-square overflow-hidden rounded-2xl border border-line bg-stone-50 text-left text-[11px] font-semibold text-ink",
              image?.url ? "bg-cover bg-center" : "p-2"
            )}
            style={image?.url ? { backgroundImage: `url(${image.url})` } : undefined}
            onClick={() => onSelect?.(slot.key)}
            disabled={disabled}
            aria-label={`${slot.label} photo slot`}
          >
            {!image?.url ? slot.label : <span className="sr-only">{slot.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
