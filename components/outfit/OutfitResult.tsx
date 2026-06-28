"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { CTABar } from "@/components/ui/CTABar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Toast } from "@/components/ui/Toast";
import { OutfitCard } from "@/components/cards/OutfitCard";
import { DigitalHumanTryOnPanel } from "@/components/avatar/DigitalHumanTryOnPanel";
import { OutfitItemCard } from "@/components/outfit/OutfitItemCard";
import { OutfitApiErrorState } from "@/components/outfit/OutfitIntegrationStates";
import {
  generateAvatarPreview,
  generateOutfitPreview,
  getAvatarPreview,
  getJobStatus,
  recordFashionMemory,
  saveOutfit,
  submitOutfitFeedback,
  swapOutfitItem,
  wearOutfit
} from "@/lib/api-client";
import type { AvatarProfileData } from "@/lib/api-client";
import type { OutfitRecommendation } from "@/types/outfit";
import { OutfitPreview } from "@/components/outfit/OutfitPreview";

const swapDirections = [
  { value: "best-match", label: "Best match" },
  { value: "more-polished", label: "More polished" },
  { value: "more-casual", label: "More casual" },
  { value: "color-change", label: "Color change" },
  { value: "weather-safe", label: "Weather-safe" },
  { value: "native-touch", label: "Native touch" }
];

const feedbackRatings = [
  { label: "Perfect", value: 5 },
  { label: "Good", value: 4 },
  { label: "Okay", value: 3 },
  { label: "Not today", value: 2 },
  { label: "Not my style", value: 1 }
];

const feedbackTags = [
  { label: "Too casual", value: "too-casual" },
  { label: "Too formal", value: "too-formal" },
  { label: "Wrong color", value: "wrong-color" },
  { label: "Weather issue", value: "weather-issue" },
  { label: "Needs native touch", value: "needs-native-touch" }
];

function Notes({ outfit }: { outfit: OutfitRecommendation }) {
  const notes = [
    outfit.occasionFit ? { label: "Occasion", body: outfit.occasionFit } : null,
    outfit.whyItWorks ? { label: "Why it works", body: outfit.whyItWorks } : null,
    { label: "Weather", body: outfit.weatherFit },
    { label: "Color", body: outfit.colorNote },
    outfit.materialNote ? { label: "Material", body: outfit.materialNote } : null,
    outfit.silhouetteNote ? { label: "Silhouette", body: outfit.silhouetteNote } : null,
    outfit.improvementNote ? { label: "Improve", body: outfit.improvementNote } : null,
    outfit.addLater ? { label: "Add later", body: outfit.addLater } : null,
    { label: "Repeat", body: outfit.repeatNote },
    { label: "Care", body: outfit.careNote }
  ].filter(Boolean) as Array<{ label: string; body: string }>;

  return (
    <Card>
      <p className="text-sm leading-6 text-muted">{outfit.summary}</p>
      <div className="mt-4 grid gap-3">
        {notes.map((note) => (
          <div key={note.label} className="rounded-2xl border border-line bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{note.label}</p>
            <p className="mt-1 text-sm leading-6 text-ink">{note.body}</p>
          </div>
        ))}
        {outfit.stylingTips?.length ? (
          <div>
            <p className="text-xs font-semibold text-ink">Styling tips</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {outfit.stylingTips.map((tip) => <Chip key={tip}>{tip}</Chip>)}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function OutfitResult({
  outfit,
  canSwap = false,
  onOutfitChange
}: {
  outfit: OutfitRecommendation;
  canSwap?: boolean;
  onOutfitChange?: (outfit: OutfitRecommendation) => void;
}) {
  const [swapOpen, setSwapOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(outfit.items[0]?.id || "");
  const [swapDirection, setSwapDirection] = useState("best-match");
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapFailed, setSwapFailed] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [rating, setRating] = useState(4);
  const [selectedFeedbackTags, setSelectedFeedbackTags] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [actionFailed, setActionFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(outfit.preview?.imageUrl || "");
  const [previewStatus, setPreviewStatus] = useState(outfit.preview?.status || "not_started");
  const [previewAccuracyLevel, setPreviewAccuracyLevel] = useState(outfit.preview?.accuracyLevel);
  const [previewError, setPreviewError] = useState("");
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewJobId, setPreviewJobId] = useState("");
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [avatarPreviewStatus, setAvatarPreviewStatus] = useState("not_started");
  const [avatarPreviewError, setAvatarPreviewError] = useState("");
  const [isGeneratingAvatarPreview, setIsGeneratingAvatarPreview] = useState(false);
  const [avatarPreviewJobId, setAvatarPreviewJobId] = useState("");
  const [avatarProfile, setAvatarProfile] = useState<AvatarProfileData["profile"] | null>(null);
  const [avatarAccuracyLevel, setAvatarAccuracyLevel] = useState<any>();
  const [avatarFitStatus, setAvatarFitStatus] = useState("");
  const [avatarFitConfidence, setAvatarFitConfidence] = useState(0);
  const [avatarFitWarnings, setAvatarFitWarnings] = useState<string[]>([]);
  const outfitItemIds = outfit.items.map((item) => item.id).filter(Boolean);

  function applyAvatarPreview(preview: any, profile?: AvatarProfileData["profile"] | null) {
    setAvatarPreviewStatus(preview.status || "not_started");
    setAvatarPreviewUrl(preview.imageUrl || preview.previewUrl || "");
    setAvatarAccuracyLevel(preview.accuracyLevel);
    setAvatarFitStatus(preview.fitStatus || "");
    setAvatarFitConfidence(typeof preview.fitConfidence === "number" ? preview.fitConfidence : 0);
    setAvatarFitWarnings(Array.isArray(preview.fitWarnings) ? preview.fitWarnings : []);
    if (profile !== undefined) setAvatarProfile(profile);
  }

  useEffect(() => {
    if (!canSwap || !outfit.id) return;
    let cancelled = false;

    void (async () => {
      const result = await getAvatarPreview(outfit.id);
      if (cancelled || !result.ok) return;
      const preview = result.data.preview;
      applyAvatarPreview(preview, result.data.avatarProfile || null);
    })();

    return () => {
      cancelled = true;
    };
  }, [canSwap, outfit.id]);

  async function remember(type: string, ratingValue?: number, feedbackText?: string) {
    return recordFashionMemory({
      type,
      itemIds: outfitItemIds,
      outfitId: outfit.id,
      recommendationId: outfit.id,
      occasion: outfit.occasion,
      rating: ratingValue,
      feedbackText,
      source: "outfit_ui"
    });
  }

  async function handleSwap() {
    if (!selectedItemId) return;
    setIsSwapping(true);
    setSwapFailed(false);
    const item = outfit.items.find((entry) => entry.id === selectedItemId);
    const result = await swapOutfitItem(outfit.id, {
      itemIdToReplace: selectedItemId,
      category: item?.category,
      swapDirection
    });
    setIsSwapping(false);

    if (result.ok) {
      onOutfitChange?.(result.data.outfit);
      setSwapOpen(false);
      return;
    }

    setSwapFailed(true);
  }

  async function handleSave(favorite = false) {
    setActionFailed(false);
    const result = await saveOutfit(outfit.id, { title: outfit.title, favorite });
    if (result.ok) {
      await remember(favorite ? "item_favorited" : "outfit_saved", favorite ? 5 : 4, favorite ? "Favorited from outfit UI" : "Saved from outfit UI");
      setToast(favorite ? "Refined your style" : "Save this look");
      window.setTimeout(() => setToast(""), 1800);
      return;
    }
    setActionFailed(true);
  }

  async function handleWear() {
    setActionFailed(false);
    const result = await wearOutfit(outfit.id, { wornAt: new Date().toISOString(), rating: feedbackRatings.find((item) => item.value === rating)?.label || "Good" });
    if (result.ok) {
      await remember("item_worn", rating, "Marked as worn from outfit UI");
      setToast("Marked as worn");
      window.setTimeout(() => setToast(""), 1800);
      return;
    }
    setActionFailed(true);
  }

  async function handleFeedback() {
    setActionFailed(false);
    const liked = rating >= 4;
    const result = await submitOutfitFeedback(outfit.id, { liked, reason: selectedFeedbackTags.join(", ") });
    await remember(liked ? "outfit_liked" : "outfit_disliked", rating, selectedFeedbackTags.join(", "));
    if (result.ok) {
      setToast("Refine my style saved");
      window.setTimeout(() => setToast(""), 1800);
      setFeedbackOpen(false);
      return;
    }
    setActionFailed(true);
  }

  async function handleQuickMemory(type: "outfit_liked" | "outfit_rejected") {
    setActionFailed(false);
    const result = await remember(type, type === "outfit_liked" ? 5 : 1, type === "outfit_liked" ? "Liked from outfit UI" : "Not my style");
    if (result.ok) {
      setToast(type === "outfit_liked" ? "Refined your style" : "Not my style saved");
      window.setTimeout(() => setToast(""), 1800);
      return;
    }
    setActionFailed(true);
  }

  async function handleGeneratePreview(regenerate = false) {
    setPreviewError("");
    setIsGeneratingPreview(true);
    setPreviewStatus("generating");

    const result = await generateOutfitPreview(outfit.id, {
      style: "flat_lay",
      regenerate
    });

    setIsGeneratingPreview(false);

    if (result.ok) {
      const preview = result.data.preview;
      setPreviewStatus(preview.status);
      setPreviewUrl(preview.imageUrl || preview.previewUrl || "");
      setPreviewAccuracyLevel(preview.accuracyLevel);
      setPreviewJobId(result.data.job?.id || "");
      if (preview.imageUrl || preview.previewUrl) setPreviewOpen(true);
      if (result.data.job?.id && preview.status !== "ready") {
        setToast("Your preview is being styled.");
        void pollPreviewJob(result.data.job.id);
        return;
      }
      setToast(preview.cached ? "Cached preview loaded" : "Preview ready.");
      window.setTimeout(() => setToast(""), 1800);
      return;
    }

    setPreviewStatus("failed");
    setPreviewError(result.error.message || "Unable to generate preview right now.");
  }

  async function pollPreviewJob(jobId: string) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
      const result = await getJobStatus(jobId);
      if (!result.ok) continue;

      const job = result.data.job;
      setPreviewStatus(job.status === "completed" ? "ready" : job.status);

      if (job.status === "completed") {
        const preview = job.result?.preview || {};
        const url = preview.imageUrl || preview.previewUrl || "";
        setPreviewAccuracyLevel(preview.accuracyLevel);
        if (url) {
          setPreviewUrl(url);
          setPreviewOpen(true);
        }
        setPreviewJobId("");
        setToast("Preview ready.");
        window.setTimeout(() => setToast(""), 1800);
        return;
      }

      if (job.status === "failed" || job.status === "cancelled") {
        setPreviewError(job.errorMessage || "Unable to generate preview right now.");
        setPreviewJobId("");
        return;
      }
    }

    setPreviewError("This may take a moment for premium AI processing. Check back shortly.");
  }

  async function handleGenerateAvatarPreview(regenerate = false) {
    setAvatarPreviewError("");
    setIsGeneratingAvatarPreview(true);
    setAvatarPreviewStatus("generating");

    const result = await generateAvatarPreview(outfit.id, {
      regenerate
    });

    setIsGeneratingAvatarPreview(false);

    if (result.ok) {
      const preview = result.data.preview;
      applyAvatarPreview(preview, result.data.avatarProfile || null);
      setAvatarPreviewJobId(result.data.job?.id || "");
      if (preview.imageUrl || preview.previewUrl) setAvatarPreviewOpen(true);
      if (result.data.job?.id && preview.status !== "ready") {
        setToast("Your Digital Human Preview is being styled.");
        void pollAvatarPreviewJob(result.data.job.id);
        return;
      }
      setToast(preview.cached ? "Digital Human cache loaded" : "Digital Human Preview ready.");
      window.setTimeout(() => setToast(""), 1800);
      return;
    }

    setAvatarPreviewStatus("failed");
    setAvatarPreviewError(result.error.message || "Unable to generate Digital Human Preview right now.");
  }

  async function pollAvatarPreviewJob(jobId: string) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
      const result = await getJobStatus(jobId);
      if (!result.ok) continue;

      const job = result.data.job;
      setAvatarPreviewStatus(job.status === "completed" ? "ready" : job.status);

      if (job.status === "completed") {
        const preview = job.result?.preview || {};
        const url = preview.imageUrl || preview.previewUrl || "";
        applyAvatarPreview({ ...preview, status: "ready" });
        if (url) {
          setAvatarPreviewUrl(url);
          setAvatarPreviewOpen(true);
        }
        setAvatarPreviewJobId("");
        setToast("Digital Human Preview ready.");
        window.setTimeout(() => setToast(""), 1800);
        return;
      }

      if (job.status === "failed" || job.status === "cancelled") {
        setAvatarPreviewError(job.errorMessage || "Unable to generate Digital Human Preview right now.");
        setAvatarPreviewJobId("");
        return;
      }
    }

    setAvatarPreviewError("This may take a moment for premium AI processing. Check back shortly.");
  }

  return (
    <>
      <OutfitCard outfit={outfit} />

      <section className="mt-7">
        <SectionHeader title="Premium AI Preview" />

        <Card className="mt-4">
          {previewUrl ? (
            <button
              type="button"
              className="focus-ring block w-full overflow-hidden rounded-2xl border border-line bg-canvas"
              onClick={() => setPreviewOpen(true)}
            >
              <img src={previewUrl} alt={`${outfit.title} AI preview`} className="aspect-square w-full object-cover" />
            </button>
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-line bg-canvas px-5 text-center">
              <p className="text-sm leading-6 text-muted">Generate a premium AI visualization from your owned wardrobe items.</p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={previewStatus === "ready" ? "success" : previewStatus === "failed" ? "danger" : "premium"}>
              {previewStatus === "ready" ? "Preview ready" : previewStatus === "failed" ? "Preview failed" : "AI visualization"}
            </Badge>
            {previewAccuracyLevel ? <Badge tone="premium">{previewAccuracyLevel.label}</Badge> : null}
            <p className="text-xs leading-5 text-muted">Not an exact virtual try-on.</p>
          </div>
          {previewStatus === "queued" || previewStatus === "processing" || previewStatus === "generating" ? (
            <p className="mt-3 text-sm font-semibold text-cocoa">Your preview is being styled. This may take a moment for premium AI processing.</p>
          ) : null}
          {previewJobId ? <p className="mt-2 text-xs text-muted">Job queued: {previewJobId.slice(-8)}</p> : null}
          {previewError ? <p className="mt-3 text-sm font-semibold text-red-600">{previewError}</p> : null}

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button onClick={() => void handleGeneratePreview(false)} disabled={isGeneratingPreview || previewStatus === "generating"}>
              {isGeneratingPreview ? "Generating..." : previewUrl ? "View cached preview" : "Generate premium preview"}
            </Button>
            {previewUrl ? (
              <Button variant="secondary" onClick={() => void handleGeneratePreview(true)} disabled={isGeneratingPreview}>
                Regenerate preview
              </Button>
            ) : null}
          </div>
        </Card>

        {previewOpen ? (
          <OutfitPreview
            previewUrl={previewUrl}
            onClose={() => setPreviewOpen(false)}
          />
        ) : null}
      </section>

      <section className="mt-7">
        <SectionHeader title="Digital Human Try-On" />

        <div className="mt-4">
          <DigitalHumanTryOnPanel
            outfit={outfit}
            avatarProfile={avatarProfile}
            previewUrl={avatarPreviewUrl}
            previewStatus={avatarPreviewStatus}
            previewError={avatarPreviewError}
            previewJobId={avatarPreviewJobId}
            isGenerating={isGeneratingAvatarPreview}
            accuracyLevel={avatarAccuracyLevel}
            fitStatus={avatarFitStatus}
            fitConfidence={avatarFitConfidence}
            fitWarnings={avatarFitWarnings}
            onOpenPreview={() => setAvatarPreviewOpen(true)}
            onGenerateFitLocked={() => void handleGenerateAvatarPreview(false)}
            onRegenerate={() => void handleGenerateAvatarPreview(true)}
          />
        </div>

        {avatarPreviewOpen ? (
          <OutfitPreview
            previewUrl={avatarPreviewUrl}
            onClose={() => setAvatarPreviewOpen(false)}
          />
        ) : null}
      </section>

      <section className="mt-7">
        <SectionHeader title="Items in this look" />

        <div className="mobile-scrollbar flex gap-3 overflow-x-auto pb-2">
          {outfit.items.map((item) => (
            <OutfitItemCard
              key={item.id}
              item={item}
            />
          ))}
        </div>
      </section>

      <section className="mt-7">
        <SectionHeader title="Why this works" />
        <Notes outfit={outfit} />
      </section>

      {/* remaining code unchanged */}

      {outfit.swapGroups?.length ? (
        <section className="mt-7">
          <SectionHeader title="Swap preview" />
          <Card className="space-y-3">
            {outfit.swapGroups.slice(0, 3).map((group) => (
              <div key={group.category} className="rounded-2xl bg-canvas p-3">
                <p className="text-xs font-semibold capitalize text-ink">{group.category}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(group.warningChips.length ? group.warningChips : ["Best match"]).map((warning) => <Chip key={warning}>{warning}</Chip>)}
                </div>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      {actionFailed ? <div className="mt-6"><OutfitApiErrorState /></div> : null}

      <CTABar className="mt-6 grid grid-cols-2 gap-2">
        {canSwap ? <Button onClick={() => void handleQuickMemory("outfit_liked")}>Refine my style</Button> : <Link href="/wardrobe/add"><Button className="w-full">Add clothes</Button></Link>}
        {canSwap ? <Button variant="secondary" onClick={() => setSwapOpen(true)}>Swap item</Button> : <Link href={`/outfit/${outfit.id}`}><Button variant="secondary" className="w-full">Open detail</Button></Link>}
        {canSwap ? <Button variant="secondary" onClick={() => void handleSave(false)}>Save this look</Button> : null}
        {canSwap ? <Button variant="secondary" onClick={() => void handleWear()}>Mark as worn</Button> : null}
        {canSwap ? <Button variant="ghost" onClick={() => void handleQuickMemory("outfit_rejected")}>Not my style</Button> : null}
        {canSwap ? <Button variant="ghost" onClick={() => setFeedbackOpen(true)}>Rate</Button> : null}
      </CTABar>
      <Toast show={Boolean(toast)} message={toast} />

      <BottomSheet open={swapOpen} onClose={() => setSwapOpen(false)} title="Swap item">
        <div className="space-y-4">
          {swapFailed ? <OutfitApiErrorState /> : null}
          <label className="block text-xs font-semibold text-ink">
            Item to swap
            <select className="focus-ring mt-1 min-h-11 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink" value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)}>
              {outfit.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {swapDirections.map((direction) => (
              <button
                key={direction.value}
                type="button"
                className={`focus-ring min-h-11 rounded-2xl border px-3 py-2 text-sm font-semibold ${swapDirection === direction.value ? "border-cocoa bg-cocoa text-white" : "border-line bg-white text-ink"}`}
                onClick={() => setSwapDirection(direction.value)}
              >
                {direction.label}
              </button>
            ))}
          </div>
          <Button className="w-full" onClick={() => void handleSwap()} disabled={isSwapping}>
            {isSwapping ? "Swapping..." : "Apply swap"}
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} title="Rate outfit">
        <p className="text-sm leading-6 text-muted">Your rating helps FitPick improve clothing, color, occasion, and weather matches.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {feedbackRatings.map((item) => (
            <Button key={item.label} variant={rating === item.value ? "primary" : "secondary"} onClick={() => setRating(item.value)}>
              {item.label}
            </Button>
          ))}
        </div>
        <div className="mt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-terracotta">Optional feedback</p>
          <div className="flex flex-wrap gap-2">
            {feedbackTags.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setSelectedFeedbackTags((current) => current.includes(item.value) ? current.filter((tag) => tag !== item.value) : [...current, item.value])}
              >
                <Chip active={selectedFeedbackTags.includes(item.value)}>{item.label}</Chip>
              </button>
            ))}
          </div>
        </div>
        <Button className="mt-5 w-full" onClick={() => void handleFeedback()}>Save feedback</Button>
        <Button className="mt-2 w-full" variant="ghost" onClick={() => void handleSave(true)}>Favorite this look</Button>
      </BottomSheet>
    </>
  );
}
