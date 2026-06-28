"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import {
  generateAvatarPreview,
  getJobStatus,
  saveOutfit,
  sendStylistMessage
} from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { OutfitRecommendation, StylistAvatarPreview, StylistResponse, StylistVisualMode } from "@/types/outfit";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  stylist?: StylistResponse;
  outfit?: OutfitRecommendation | null;
  outfitRecommendationId?: string | null;
  avatarPreview?: StylistAvatarPreview;
  visualMode?: StylistVisualMode;
  visualizationDisclaimer?: string;
  fitLock?: StylistResponse["fitLock"];
  jobId?: string | null;
};

const promptSuggestions = [
  "Style me for church this Sunday",
  "Build a polished date night outfit",
  "What should I wear to a Nigerian wedding?",
  "Give me a business casual look for a hot day"
];

function messageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function previewTone(status?: string) {
  if (status === "ready") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "queued" || status === "generating" || status === "processing") return "premium" as const;
  return "neutral" as const;
}

function previewLabel(status?: string) {
  if (status === "ready") return "Digital Human ready";
  if (status === "failed") return "Preview failed";
  if (status === "queued") return "Preview queued";
  if (status === "generating" || status === "processing") return "Creating look";
  return "Digital Human";
}

function compactPreview(preview?: Partial<StylistAvatarPreview>): StylistAvatarPreview {
  return {
    status: preview?.status || "not_started",
    jobId: preview?.jobId ?? null,
    previewId: preview?.previewId ?? null,
    imageUrl: preview?.imageUrl ?? null,
    cacheKey: preview?.cacheKey ?? null,
    errorMessage: preview?.errorMessage ?? null,
    accuracyLevel: preview?.accuracyLevel,
    fitStatus: preview?.fitStatus,
    fitConfidence: preview?.fitConfidence,
    fitWarnings: preview?.fitWarnings
  };
}

function ItemStrip({ outfit }: { outfit: OutfitRecommendation }) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-ink">Recommended from your wardrobe</p>
      <div className="mobile-scrollbar flex gap-2 overflow-x-auto pb-1">
        {outfit.items.map((item) => (
          <div key={item.id} className="w-32 shrink-0 overflow-hidden rounded-xl border border-line bg-white">
            {item.thumbnailUrl || item.imageUrl ? (
              <img src={item.thumbnailUrl || item.imageUrl} alt={item.name} className="aspect-square w-full object-cover" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-canvas px-2 text-center text-xs text-muted">
                {item.category}
              </div>
            )}
            <div className="space-y-1 p-2">
              <p className="truncate text-xs font-semibold text-ink">{item.name}</p>
              <p className="truncate text-[11px] text-muted">{[item.color, item.category].filter(Boolean).join(" • ")}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StylistChat() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [includeVisualization, setIncludeVisualization] = useState(true);
  const recentMessages = useMemo(() => messages.slice(-8), [messages]);

  function patchMessage(id: string, patch: Partial<ChatMessage>) {
    setMessages((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 1800);
  }

  async function pollAvatarJob(messageIdToPatch: string, jobId: string) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await wait(2500);
      const result = await getJobStatus(jobId);
      if (!result.ok) continue;

      const job = result.data.job;
      if (job.status === "completed") {
        const preview = job.result?.preview || {};
        patchMessage(messageIdToPatch, {
          avatarPreview: compactPreview({
            status: "ready",
            previewId: preview.id || null,
            imageUrl: preview.imageUrl || preview.previewUrl || null,
            cacheKey: preview.cacheKey || null,
            errorMessage: null,
            accuracyLevel: preview.accuracyLevel,
            fitStatus: preview.fitStatus,
            fitConfidence: preview.fitConfidence,
            fitWarnings: preview.fitWarnings
          }),
          jobId: null
        });
        showToast("Digital Human Preview ready.");
        return;
      }

      if (job.status === "failed" || job.status === "cancelled") {
        patchMessage(messageIdToPatch, {
          avatarPreview: compactPreview({
            status: "failed",
            errorMessage: job.errorMessage || "Unable to generate Digital Human Preview right now."
          }),
          jobId: null
        });
        return;
      }

      patchMessage(messageIdToPatch, {
        avatarPreview: compactPreview({
          status: job.status === "queued" ? "queued" : "generating",
          jobId
        }),
        jobId
      });
    }

    patchMessage(messageIdToPatch, {
      avatarPreview: compactPreview({
        status: "generating",
        jobId,
        errorMessage: "This may take a moment for premium AI processing. Check back shortly."
      }),
      jobId
    });
  }

  async function submitStylistMessage(text?: string, options: { includeVisualization?: boolean; visualMode?: StylistVisualMode } = {}) {
    const trimmed = (text ?? message).trim();
    if (!trimmed || loading) return;

    const userEntry: ChatMessage = { id: messageId(), role: "user", content: trimmed };
    const assistantId = messageId();
    const assistantEntry: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "Your stylist is building your look..."
    };
    const sessionMessages = [...messages, userEntry, assistantEntry];

    setLoading(true);
    setError("");
    setMessage("");
    setMessages(sessionMessages);

    const response = await sendStylistMessage(trimmed, {
      includeVisualization: options.includeVisualization ?? includeVisualization,
      visualMode: options.visualMode || "digital_human",
      recentMessages: recentMessages.map((entry) => ({ role: entry.role, content: entry.content }))
    });

    setLoading(false);

    if (!response.ok) {
      const safeMessage = response.error.message || "Unable to reach FitPick Stylist right now.";
      setError(safeMessage);
      patchMessage(assistantId, { content: safeMessage });
      return;
    }

    const avatarPreview = compactPreview(response.data.avatarPreview || response.data.stylist.avatarPreview);
    const jobId = response.data.job?.id || avatarPreview.jobId || null;
    patchMessage(assistantId, {
      content: response.data.reply,
      stylist: response.data.stylist,
      outfit: response.data.outfit,
      outfitRecommendationId: response.data.outfitRecommendationId,
      avatarPreview,
      visualMode: response.data.visualization?.visualMode || response.data.stylist.visualMode || "none",
      visualizationDisclaimer: response.data.visualization?.visualizationDisclaimer || response.data.stylist.visualizationDisclaimer,
      fitLock: response.data.visualization?.fitLock || response.data.stylist.fitLock,
      jobId
    });

    if (jobId && avatarPreview.status !== "ready") {
      void pollAvatarJob(assistantId, jobId);
    }
  }

  async function handleSaveLook(entry: ChatMessage) {
    if (!entry.outfitRecommendationId) return;
    const result = await saveOutfit(entry.outfitRecommendationId, {
      title: entry.outfit?.title || "Stylist look",
      favorite: false
    });
    showToast(result.ok ? "Look saved." : "Unable to save look right now.");
  }

  async function handleRegenerate(entry: ChatMessage) {
    if (!entry.outfitRecommendationId) return;
    patchMessage(entry.id, {
      avatarPreview: compactPreview({
        ...entry.avatarPreview,
        status: "generating",
        errorMessage: null
      })
    });

    const result = await generateAvatarPreview(entry.outfitRecommendationId, { regenerate: true });
    if (!result.ok) {
      patchMessage(entry.id, {
        avatarPreview: compactPreview({
          status: "failed",
          errorMessage: result.error.message || "Unable to regenerate Digital Human Preview right now."
        })
      });
      return;
    }

    const preview = result.data.preview;
    const jobId = result.data.job?.id || null;
    patchMessage(entry.id, {
      avatarPreview: compactPreview({
        status: preview.status as StylistAvatarPreview["status"],
        jobId,
        previewId: preview.id || null,
        imageUrl: preview.imageUrl || preview.previewUrl || null,
        cacheKey: preview.cacheKey || null,
        errorMessage: preview.errorMessage || null,
        accuracyLevel: preview.accuracyLevel,
        fitStatus: preview.fitStatus,
        fitConfidence: preview.fitConfidence,
        fitWarnings: preview.fitWarnings
      }),
      jobId
    });

    if (jobId && preview.status !== "ready") {
      void pollAvatarJob(entry.id, jobId);
    }
  }

  function renderAssistantAddOns(entry: ChatMessage) {
    const outfit = entry.outfit;
    const preview = entry.avatarPreview;
    const status = preview?.status || "not_started";
    const hasVisualization = entry.visualMode === "digital_human" || Boolean(entry.outfitRecommendationId);

    return (
      <>
        {outfit ? <ItemStrip outfit={outfit} /> : null}

        {hasVisualization ? (
          <div className="mt-3 rounded-xl border border-line bg-canvas p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={previewTone(status)}>{previewLabel(status)}</Badge>
              {entry.outfitRecommendationId ? <Badge tone="neutral">Look {entry.outfitRecommendationId.slice(-6)}</Badge> : null}
              {preview?.accuracyLevel ? <Badge tone={preview.accuracyLevel.id === "fit_locked" ? "success" : "premium"}>{preview.accuracyLevel.label}</Badge> : null}
              {entry.fitLock?.fitStatus ? <Badge tone={entry.fitLock.fitStatus === "likely_fits" ? "success" : "warning"}>{entry.fitLock.fitStatus.replace(/_/g, " ")}</Badge> : null}
            </div>

            {preview?.imageUrl ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-line bg-white">
                <img src={preview.imageUrl} alt="FitPick Digital Human visualization" className="aspect-square w-full object-cover" />
              </div>
            ) : status === "queued" || status === "generating" || status === "processing" ? (
              <div className="mt-3 flex min-h-40 items-center justify-center rounded-xl border border-dashed border-line bg-white px-4 text-center">
                <p className="text-sm font-semibold text-cocoa">Creating your Digital Human look...</p>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-line bg-white px-4 py-5 text-center">
                <p className="text-sm leading-6 text-muted">
                  {preview?.errorMessage || "Digital Human Preview will appear here when available."}
                </p>
              </div>
            )}

            <p className="mt-3 text-xs leading-5 text-muted">{entry.visualizationDisclaimer || "AI visualization, not exact virtual try-on."}</p>
            {(entry.fitLock?.warnings?.length || preview?.fitWarnings?.length) ? (
              <div className="mt-3 space-y-1 rounded-xl border border-warning/20 bg-warning/10 p-3">
                {(entry.fitLock?.warnings || preview?.fitWarnings || []).slice(0, 3).map((warning) => (
                  <p key={warning} className="text-xs leading-5 text-ink">{warning}</p>
                ))}
              </div>
            ) : null}
            {entry.jobId ? <p className="mt-1 text-[11px] text-muted">Job queued: {entry.jobId.slice(-8)}</p> : null}

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {entry.outfitRecommendationId ? (
                <Button type="button" onClick={() => void handleSaveLook(entry)}>
                  Save look
                </Button>
              ) : null}
              {entry.outfitRecommendationId ? (
                <Button type="button" variant="secondary" onClick={() => void handleRegenerate(entry)}>
                  Regenerate avatar look
                </Button>
              ) : null}
              <Link href="/avatar" className="block">
                <Button type="button" variant="secondary" className="w-full">
                  Improve fit accuracy
                </Button>
              </Link>
              {outfit ? (
                <>
                  <Button type="button" variant="ghost" onClick={() => void submitStylistMessage(`Make this ${outfit.occasion || "look"} more formal`, { includeVisualization: true })}>
                    Make it more formal
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => void submitStylistMessage(`Make this ${outfit.occasion || "look"} more casual`, { includeVisualization: true })}>
                    Make it more casual
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <section className="space-y-4 pb-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">Premium personal stylist</p>
            <p className="mt-1 text-xs leading-5 text-muted">Grounded in your wardrobe, Style DNA, and fashion memory.</p>
          </div>
          <Badge tone="premium">Wardrobe-only</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {promptSuggestions.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="focus-ring rounded-full"
              onClick={() => setMessage(prompt)}
              disabled={loading}
            >
              <Chip>{prompt}</Chip>
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1" aria-live="polite">
          {messages.length ? (
            messages.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "rounded-2xl px-3 py-2 text-sm leading-6",
                  entry.role === "user" ? "ml-8 bg-cocoa text-white" : "mr-2 border border-line bg-white text-ink sm:mr-8"
                )}
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] opacity-80">
                  {entry.role === "user" ? "You" : "FitPick Stylist"}
                </p>
                <p className="whitespace-pre-wrap">{entry.content}</p>
                {entry.role === "assistant" ? renderAssistantAddOns(entry) : null}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-white px-4 py-5 text-center">
              <p className="text-sm font-semibold text-ink">Ask for a complete look</p>
              <p className="mt-2 text-xs leading-5 text-muted">Try occasion, weather, mood, or dress code. FitPick will stay grounded in what you own.</p>
            </div>
          )}

          {loading ? (
            <div className="mr-8 rounded-2xl border border-line bg-white px-3 py-2 text-sm leading-6 text-muted">
              Your stylist is building your look...
            </div>
          ) : null}
        </div>

        {error ? <p className="rounded-2xl bg-danger/10 px-3 py-2 text-xs font-semibold text-ink">{error}</p> : null}
        {toast ? <p className="rounded-2xl bg-success/10 px-3 py-2 text-xs font-semibold text-success">{toast}</p> : null}

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submitStylistMessage();
          }}
        >
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask FitPick what to wear..."
            className="focus-ring min-h-28 w-full resize-none rounded-2xl border border-line bg-white px-3 py-3 text-sm leading-6 text-ink outline-none placeholder:text-muted"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink">
              <input
                type="checkbox"
                checked={includeVisualization}
                onChange={(event) => setIncludeVisualization(event.target.checked)}
                className="h-4 w-4 rounded border-line text-cocoa"
              />
              Digital Human
            </label>
            <Badge tone={includeVisualization ? "premium" : "neutral"}>
              {includeVisualization ? "Visual styling on" : "Text only"}
            </Badge>
          </div>

          <Button type="submit" className="w-full" disabled={loading || !message.trim()}>
            {loading ? "Styling..." : "Ask FitPick Stylist"}
          </Button>
        </form>
      </Card>
    </section>
  );
}
