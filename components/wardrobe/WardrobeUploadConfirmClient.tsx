"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ConfidenceBadge } from "@/components/wardrobe/ConfidenceBadge";
import { WardrobeImageSlots } from "@/components/wardrobe/WardrobeImageSlots";
import {
  WardrobeApiErrorState,
  WardrobeAuthRequiredState,
  WardrobeBackendUnavailableState,
  WardrobeLoadingState,
  WardrobeSaveSuccessState
} from "@/components/wardrobe/WardrobeIntegrationStates";
import { AITagConfirmationForm, type AITagConfirmationValues } from "@/components/wardrobe/AITagConfirmationForm";
import { useSession } from "@/hooks/use-session";
import { analyzeWardrobeUpload, confirmWardrobeUploadTags, getJobStatus, getWardrobeUpload, type WardrobeUploadRecord } from "@/lib/api-client";
import type { WardrobeItem } from "@/types/wardrobe";

function cleanItemPayload(values: AITagConfirmationValues) {
  return {
    name: values.name,
    category: values.category,
    subcategory: values.subcategory || "",
    color: values.color,
    pattern: values.pattern || "",
    fabric: values.fabric || "",
    fit: values.fit || "",
    formality: values.formality,
    occasions: values.occasions,
    weather: values.weather,
    condition: values.condition,
    verifiedFields: values.verifiedFields
  };
}

export function WardrobeUploadConfirmClient({ uploadId }: { uploadId: string }) {
  const session = useSession();
  const router = useRouter();
  const [upload, setUpload] = useState<WardrobeUploadRecord | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "not-found" | "unavailable" | "error">("idle");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [createdItem, setCreatedItem] = useState<WardrobeItem | null>(null);
  const [message, setMessage] = useState("");
  const [analysisJobId, setAnalysisJobId] = useState("");

  const warnings = useMemo(() => upload?.aiAnalysis?.labelWarnings || [], [upload]);
  const lowConfidenceCount = useMemo(() => {
    const fields = upload?.aiAnalysis?.fields;
    if (!fields) return 0;
    return Object.values(fields).filter((field) => field.confidence < 0.65).length;
  }, [upload]);

  const loadUpload = useCallback(async () => {
    setStatus("loading");
    const result = await getWardrobeUpload(uploadId);
    if (result.ok) {
      setUpload(result.data.upload);
      setStatus("ready");
      return result.data.upload;
    }

    setUpload(null);
    setStatus(result.error.code === "NOT_FOUND" ? "not-found" : result.error.code === "INTERNAL_ERROR" ? "unavailable" : "error");
    return null;
  }, [uploadId]);

  const analyzeUpload = useCallback(async () => {
    setIsAnalyzing(true);
    setMessage("");
    const result = await analyzeWardrobeUpload(uploadId);

    if (result.ok) {
      if ((result.data as any).job?.id) {
        const jobId = (result.data as any).job.id;
        setAnalysisJobId(jobId);
        setMessage("FitPick is analyzing your garment intelligence. This may take a moment for premium AI processing.");

        for (let attempt = 0; attempt < 30; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 2500));
          const jobResult = await getJobStatus(jobId);
          if (!jobResult.ok) continue;

          if (jobResult.data.job.status === "completed") {
            setAnalysisJobId("");
            setIsAnalyzing(false);
            const refreshed = await loadUpload();
            setMessage("AI analysis is ready for review.");
            return refreshed;
          }

          if (jobResult.data.job.status === "failed" || jobResult.data.job.status === "cancelled") {
            setAnalysisJobId("");
            setIsAnalyzing(false);
            setMessage(jobResult.data.job.errorMessage || "Analysis failed. Add tags manually.");
            return await loadUpload();
          }
        }

        setIsAnalyzing(false);
        setMessage("FitPick is still analyzing your garment intelligence. Refresh shortly to continue.");
        return await loadUpload();
      }

      setIsAnalyzing(false);
      const refreshed = await loadUpload();
      setMessage(result.data.aiTagStatus === "failed" ? result.data.safeMessage || "Analysis failed. Add tags manually." : "AI analysis is ready for review.");
      return refreshed;
    }

    setIsAnalyzing(false);
    setMessage("AI analysis is unavailable. You can still save tags manually.");
    setStatus(result.error.code === "INTERNAL_ERROR" ? "unavailable" : "error");
    return null;
  }, [loadUpload, uploadId]);

  useEffect(() => {
    if (session.status !== "authenticated") return;

    void (async () => {
      const loaded = await loadUpload();
      if (loaded && loaded.aiTagStatus === "not_started") {
        await analyzeUpload();
      }
    })();
  }, [analyzeUpload, loadUpload, session.status]);

  async function handleConfirm(values: AITagConfirmationValues) {
    setIsSaving(true);
    setMessage("");
    const result = await confirmWardrobeUploadTags(uploadId, cleanItemPayload(values));
    setIsSaving(false);

    if (result.ok) {
      setCreatedItem(result.data.item);
      setUpload(result.data.upload);
      return;
    }

    setStatus(result.error.code === "INTERNAL_ERROR" ? "unavailable" : "error");
  }

  if (session.status === "loading" || status === "loading" || (session.status === "authenticated" && status === "idle")) {
    return <WardrobeLoadingState />;
  }

  if (session.status === "logged-out") return <WardrobeAuthRequiredState />;
  if (session.status === "backend-unavailable" || status === "unavailable") {
    return <WardrobeBackendUnavailableState onRetry={() => void loadUpload()} />;
  }
  if (status === "error") return <WardrobeApiErrorState onRetry={() => void loadUpload()} />;

  if (status === "not-found" || !upload) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">Upload not found</p>
        <p className="mt-2 text-xs leading-5 text-muted">This upload is not available for confirmation.</p>
        <Link href="/wardrobe/upload">
          <Button className="mt-4 w-full">Start upload</Button>
        </Link>
      </Card>
    );
  }

  if (createdItem) {
    return (
      <div className="mt-7 space-y-5">
        <WardrobeSaveSuccessState
          title="Added to wardrobe"
          body={`${createdItem.name} is saved and ready for outfit planning.`}
          href={`/wardrobe/${createdItem.id}`}
        />
        <Button type="button" className="w-full" onClick={() => router.push(`/wardrobe/${createdItem.id}`)}>
          View wardrobe item
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-7 space-y-7">
      <section>
        <SectionHeader title="Uploaded photos" eyebrow="AI review" />
        <Card className="space-y-4">
          <WardrobeImageSlots images={upload.images as any} disabled />
          <div className="rounded-2xl bg-cocoa/10 px-3 py-2 text-xs leading-5 text-ink">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{isAnalyzing ? "Analyzing photos..." : upload.aiAnalysis ? "Review your garment intelligence" : "Waiting for analysis"}</p>
              {upload.aiAnalysis ? <ConfidenceBadge confidence={upload.aiConfidence || 0} /> : null}
            </div>
            {message ? <p className="mt-1 text-muted">{message}</p> : null}
          </div>
          {warnings.length || lowConfidenceCount ? (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-5 text-ink">
              <p className="font-semibold">Confirm what FitPick detected</p>
              {lowConfidenceCount ? <p className="mt-1 text-muted">{lowConfidenceCount} field{lowConfidenceCount === 1 ? "" : "s"} marked low confidence — please verify.</p> : null}
              {warnings.map((warning) => <p key={warning} className="mt-1 text-muted">{warning}</p>)}
            </div>
          ) : null}
          <Button type="button" variant="secondary" className="w-full" onClick={() => void analyzeUpload()} disabled={isAnalyzing || isSaving}>
            {isAnalyzing ? "Analyzing..." : "Run AI analysis again"}
          </Button>
        </Card>
      </section>

      <section>
        <SectionHeader title="Confirm what FitPick detected" eyebrow="Verified save" />
        <Card>
          <AITagConfirmationForm
            aiAnalysis={upload.aiAnalysis}
            disabled={isAnalyzing || isSaving}
            onSubmit={handleConfirm}
          />
        </Card>
      </section>
    </div>
  );
}
