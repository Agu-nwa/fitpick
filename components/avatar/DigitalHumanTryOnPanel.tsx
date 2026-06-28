"use client";

import Link from "next/link";
import { AvatarViewer } from "@/components/avatar/AvatarViewer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { AvatarProfileData } from "@/lib/api-client";
import type { OutfitRecommendation, PreviewAccuracySummary } from "@/types/outfit";

type DigitalHumanTryOnPanelProps = {
  outfit: OutfitRecommendation;
  avatarProfile?: AvatarProfileData["profile"] | null;
  previewUrl?: string;
  previewStatus?: string;
  previewError?: string;
  previewJobId?: string;
  isGenerating?: boolean;
  accuracyLevel?: PreviewAccuracySummary;
  fitStatus?: string;
  fitConfidence?: number;
  fitWarnings?: string[];
  onOpenPreview?: () => void;
  onGenerateFitLocked?: () => void;
  onRegenerate?: () => void;
};

function fitStatusLabel(status?: string) {
  if (status === "likely_fits") return "Likely fits";
  if (status === "may_be_tight") return "May be tight";
  if (status === "may_be_loose") return "May be loose";
  if (status === "oversized_intended") return "Oversized intended";
  if (status === "measurements_needed") return "Measurements needed";
  return "Fit unknown";
}

export function DigitalHumanTryOnPanel({
  outfit,
  avatarProfile,
  previewUrl,
  previewStatus = "not_started",
  previewError = "",
  previewJobId = "",
  isGenerating = false,
  accuracyLevel,
  fitStatus,
  fitConfidence = 0,
  fitWarnings = [],
  onOpenPreview,
  onGenerateFitLocked,
  onRegenerate
}: DigitalHumanTryOnPanelProps) {
  return (
    <div className="space-y-4">
      <AvatarViewer profile={avatarProfile} />

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Digital Human try-on foundation</p>
            <p className="mt-1 text-xs leading-5 text-muted">AI Visualization and Garment-Referenced previews are not exact virtual try-on.</p>
          </div>
          <Badge tone={accuracyLevel?.id === "fit_locked" ? "success" : "premium"}>
            {accuracyLevel?.label || "AI Visualization"}
          </Badge>
        </div>

        {previewUrl ? (
          <button
            type="button"
            className="focus-ring block w-full overflow-hidden rounded-2xl border border-line bg-canvas"
            onClick={onOpenPreview}
          >
            <img src={previewUrl} alt={`${outfit.title} Digital Human Preview`} className="aspect-square w-full object-cover" />
          </button>
        ) : (
          <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-line bg-canvas px-5 text-center">
            <p className="text-sm leading-6 text-muted">Generate a fit-locked preview from this owned wardrobe look.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={previewStatus === "ready" ? "success" : previewStatus === "failed" ? "danger" : "premium"}>
            {previewStatus === "ready" ? "Preview ready" : previewStatus === "failed" ? "Preview failed" : "Preview mode"}
          </Badge>
          <Badge tone={fitStatus === "likely_fits" || fitStatus === "oversized_intended" ? "success" : "warning"}>
            {fitStatusLabel(fitStatus)}
          </Badge>
          <Badge tone="neutral">Confidence {Math.round((fitConfidence || 0) * 100)}%</Badge>
        </div>

        <div className="mobile-scrollbar flex gap-2 overflow-x-auto pb-1">
          {outfit.items.map((item) => (
            <div key={item.id} className="w-28 shrink-0 overflow-hidden rounded-xl border border-line bg-white">
              {item.thumbnailUrl || item.imageUrl ? (
                <img src={item.thumbnailUrl || item.imageUrl} alt={item.name} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-canvas px-2 text-center text-xs text-muted">{item.category}</div>
              )}
              <div className="p-2">
                <p className="truncate text-xs font-semibold text-ink">{item.name}</p>
                <p className="truncate text-[11px] text-muted">{[item.taggedSize, item.garmentFit].filter(Boolean).join(" • ") || item.category}</p>
              </div>
            </div>
          ))}
        </div>

        {fitWarnings.length ? (
          <div className="space-y-2 rounded-2xl border border-warning/20 bg-warning/10 p-3">
            {fitWarnings.slice(0, 4).map((warning) => (
              <p key={warning} className="text-xs leading-5 text-ink">{warning}</p>
            ))}
          </div>
        ) : null}

        {previewStatus === "queued" || previewStatus === "processing" || previewStatus === "generating" ? (
          <p className="text-sm font-semibold text-cocoa">Your Digital Human Preview is being styled. This may take a moment.</p>
        ) : null}
        {previewJobId ? <p className="text-xs text-muted">Job queued: {previewJobId.slice(-8)}</p> : null}
        {previewError ? <p className="text-sm font-semibold text-red-600">{previewError}</p> : null}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button type="button" onClick={onGenerateFitLocked} disabled={isGenerating || previewStatus === "generating"}>
            {isGenerating ? "Generating..." : previewUrl ? "View fit-locked preview" : "Generate fit-locked preview"}
          </Button>
          <Link href="/avatar">
            <Button type="button" variant="secondary" className="w-full">Add measurements</Button>
          </Link>
          <Link href="/avatar">
            <Button type="button" variant="secondary" className="w-full">Improve fit accuracy</Button>
          </Link>
          <Button type="button" variant="secondary" disabled title="Connect a real 3D garment simulation provider first.">
            Request True 3D Simulation
          </Button>
          {previewUrl ? (
            <Button type="button" variant="ghost" onClick={onRegenerate} disabled={isGenerating}>
              Regenerate preview
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
