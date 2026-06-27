"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  WardrobeApiErrorState,
  WardrobeAuthRequiredState,
  WardrobeBackendUnavailableState,
  WardrobeLoadingState,
  WardrobeSaveSuccessState
} from "@/components/wardrobe/WardrobeIntegrationStates";
import { WardrobeImageSlots } from "@/components/wardrobe/WardrobeImageSlots";
import { WardrobeTagReviewForm, type WardrobeTagFormValues } from "@/components/wardrobe/WardrobeTagReviewForm";
import { useSession } from "@/hooks/use-session";
import {
  analyzeWardrobeUpload,
  createWardrobeItem,
  requestSignedUploadUrl,
  uploadWardrobeMetadata
} from "@/lib/api-client";
import type { WardrobeImageAsset, WardrobeImagePurpose } from "@/types/ai-tagging";
import type { WardrobeItem } from "@/types/wardrobe";

const slotOrder: WardrobeImagePurpose[] = ["front", "back", "fabricCloseUp", "label"];

const slotCopy: Record<WardrobeImagePurpose, { title: string; body: string }> = {
  front: { title: "Front", body: "Shape, color, neckline, closure" },
  back: { title: "Back", body: "Back fit and construction" },
  fabricCloseUp: { title: "Fabric", body: "Texture, weave, print detail" },
  label: { title: "Label", body: "Size, brand, care, composition" },
  additional: { title: "Extra", body: "Optional supporting photo" }
};

type SlotFile = {
  file: File;
  previewUrl: string;
};

type UploadedSlot = WardrobeImageAsset & {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  thumbnailUrl: string;
};

function toImageAsset(uploaded: UploadedSlot): WardrobeImageAsset {
  return {
    url: uploaded.url,
    storageKey: uploaded.storageKey,
    provider: uploaded.provider,
    uploadedAt: uploaded.uploadedAt,
    purpose: uploaded.purpose
  };
}

function cleanItemPayload(values: WardrobeTagFormValues) {
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
    condition: values.condition
  };
}

function localSlotAssets(slotFiles: Partial<Record<WardrobeImagePurpose, SlotFile>>) {
  return Object.fromEntries(
    Object.entries(slotFiles).map(([purpose, value]) => [
      purpose,
      {
        url: value?.previewUrl || "",
        storageKey: "",
        provider: "local_placeholder",
        purpose
      }
    ])
  ) as Partial<Record<WardrobeImagePurpose, WardrobeImageAsset>>;
}

export function WardrobeAddClient() {
  const session = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePurpose, setActivePurpose] = useState<WardrobeImagePurpose>("front");
  const [slotFiles, setSlotFiles] = useState<Partial<Record<WardrobeImagePurpose, SlotFile>>>({});
  const [createdItem, setCreatedItem] = useState<WardrobeItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [status, setStatus] = useState<"idle" | "unavailable" | "error">("idle");
  const [message, setMessage] = useState("");

  const slotImages = useMemo(() => localSlotAssets(slotFiles), [slotFiles]);
  const selectedCount = Object.keys(slotFiles).length;
  const missingRequired = slotOrder.filter((purpose) => !slotFiles[purpose]);

  function handleSelectSlot(purpose: WardrobeImagePurpose) {
    setActivePurpose(purpose);
    fileInputRef.current?.click();
  }

  function handleFile(purpose: WardrobeImagePurpose, file: File) {
    setSlotFiles((current) => {
      if (current[purpose]?.previewUrl) URL.revokeObjectURL(current[purpose]?.previewUrl || "");
      return {
        ...current,
        [purpose]: {
          file,
          previewUrl: URL.createObjectURL(file)
        }
      };
    });
    setMessage("");
    setStatus("idle");
  }

  function removeSlot(purpose: WardrobeImagePurpose) {
    setSlotFiles((current) => {
      if (current[purpose]?.previewUrl) URL.revokeObjectURL(current[purpose]?.previewUrl || "");
      const next = { ...current };
      delete next[purpose];
      return next;
    });
  }

  async function uploadSlot(purpose: WardrobeImagePurpose, slot: SlotFile): Promise<UploadedSlot> {
    const signed = await requestSignedUploadUrl({
      filename: slot.file.name,
      mimeType: slot.file.type || "image/jpeg",
      sizeBytes: slot.file.size,
      purpose: `wardrobe_${purpose}`
    });

    if (!signed.ok) throw new Error(signed.error.message);
    const uploadAccess = signed.data.upload;
    const uploadUrl = uploadAccess.uploadUrl;
    if (!uploadAccess.ready || !uploadUrl) {
      throw new Error(uploadAccess.message || "Image upload is not configured yet.");
    }

    const s3Response = await fetch(uploadUrl, {
      method: uploadAccess.method || "PUT",
      headers: uploadAccess.headers || { "content-type": slot.file.type || "image/jpeg" },
      body: slot.file
    });

    if (!s3Response.ok) {
      throw new Error("We could not upload one of the photos.");
    }

    const publicUrl = uploadAccess.publicUrl || uploadAccess.uploadUrl?.split("?")[0] || "";
    const storageKey = uploadAccess.storageKey;

    return {
      url: publicUrl,
      storageKey,
      provider: "s3",
      uploadedAt: new Date().toISOString(),
      purpose,
      filename: slot.file.name,
      mimeType: slot.file.type || "image/jpeg",
      sizeBytes: slot.file.size,
      width: 1,
      height: 1,
      thumbnailUrl: publicUrl
    };
  }

  async function handleMultiPhotoUpload() {
    if (!selectedCount) {
      setMessage("Add the front, back, fabric, and label photos before continuing.");
      return;
    }

    if (missingRequired.length) {
      setMessage(`Missing ${missingRequired.map((purpose) => slotCopy[purpose].title.toLowerCase()).join(", ")} photo${missingRequired.length === 1 ? "" : "s"}.`);
      return;
    }

    setIsSaving(true);
    setStatus("idle");
    setMessage("");

    try {
      const uploaded = await Promise.all(
        slotOrder.map(async (purpose) => {
          const slot = slotFiles[purpose];
          if (!slot) throw new Error(`Missing ${slotCopy[purpose].title.toLowerCase()} photo.`);
          return uploadSlot(purpose, slot);
        })
      );

      const byPurpose = Object.fromEntries(uploaded.map((asset) => [asset.purpose, asset])) as Record<WardrobeImagePurpose, UploadedSlot>;
      const primary = byPurpose.front || uploaded[0];
      const result = await uploadWardrobeMetadata({
        filename: primary.filename,
        mimeType: primary.mimeType,
        sizeBytes: primary.sizeBytes,
        width: primary.width || 1,
        height: primary.height || 1,
        provider: "s3",
        storageKey: primary.storageKey,
        publicId: primary.storageKey,
        imageUrl: primary.url,
        secureUrl: primary.url,
        thumbnailUrl: primary.thumbnailUrl,
        uploadStatus: "uploaded",
        images: {
          front: toImageAsset(byPurpose.front),
          back: toImageAsset(byPurpose.back),
          fabricCloseUp: toImageAsset(byPurpose.fabricCloseUp),
          label: toImageAsset(byPurpose.label),
          additional: []
        }
      });

      if (!result.ok) {
        setStatus(result.error.code === "INTERNAL_ERROR" ? "unavailable" : "error");
        setMessage("FitPick could not create the wardrobe upload record.");
        return;
      }

      setIsSaving(false);
      setIsAnalyzing(true);
      const analysis = await analyzeWardrobeUpload(result.data.upload.id);
      setIsAnalyzing(false);

      if (!analysis.ok) {
        setMessage("Upload saved, but AI analysis did not finish. You can review manually on the next screen.");
      }

      router.push(`/wardrobe/${result.data.upload.id}/confirm`);
    } catch (error) {
      setIsSaving(false);
      setIsAnalyzing(false);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "We could not upload these photos. Try again.");
    }
  }

  async function handleManualCreate(values: WardrobeTagFormValues) {
    setIsSaving(true);
    setStatus("idle");
    const result = await createWardrobeItem(cleanItemPayload(values));
    setIsSaving(false);

    if (result.ok) {
      setCreatedItem(result.data.item);
      return;
    }

    setStatus(result.error.code === "INTERNAL_ERROR" ? "unavailable" : "error");
  }

  if (session.status === "loading") return <WardrobeLoadingState />;
  if (session.status === "logged-out") return <WardrobeAuthRequiredState />;
  if (session.status === "backend-unavailable") return <WardrobeBackendUnavailableState onRetry={session.refresh} />;

  return (
    <div className="mt-7 space-y-7">
      {status === "unavailable" ? <WardrobeBackendUnavailableState /> : null}
      {status === "error" ? <WardrobeApiErrorState /> : null}
      {createdItem ? (
        <WardrobeSaveSuccessState
          title="Added to wardrobe"
          body={`${createdItem.name} is saved and ready for outfit planning.`}
          href={`/wardrobe/${createdItem.id}`}
        />
      ) : null}

      <section>
        <SectionHeader title="Add item photos" eyebrow="Front, back, fabric, label" />
        <Card className="space-y-4">
          <WardrobeImageSlots images={slotImages} onSelect={handleSelectSlot} disabled={isSaving || isAnalyzing} />
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="image/*"
            capture={activePurpose === "front" ? "environment" : undefined}
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              if (file) handleFile(activePurpose, file);
              event.currentTarget.value = "";
            }}
          />

          <div className="grid grid-cols-2 gap-3">
            {slotOrder.map((purpose) => {
              const slot = slotFiles[purpose];
              return (
                <div key={purpose} className="rounded-2xl border border-line bg-white p-3">
                  <p className="text-xs font-semibold text-ink">{slotCopy[purpose].title}</p>
                  <p className="mt-1 min-h-8 text-[11px] leading-4 text-muted">{slot ? slot.file.name : slotCopy[purpose].body}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button type="button" variant="secondary" className="min-h-9 rounded-xl px-2 py-2 text-[11px]" onClick={() => handleSelectSlot(purpose)} disabled={isSaving || isAnalyzing}>
                      {slot ? "Replace" : "Add"}
                    </Button>
                    <Button type="button" variant="ghost" className="min-h-9 rounded-xl px-2 py-2 text-[11px]" onClick={() => removeSlot(purpose)} disabled={!slot || isSaving || isAnalyzing}>
                      Clear
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <Button type="button" className="w-full" onClick={() => void handleMultiPhotoUpload()} disabled={isSaving || isAnalyzing}>
            {isSaving ? "Uploading photos..." : isAnalyzing ? "Analyzing item..." : "Upload and analyze"}
          </Button>

          {message ? (
            <p className="rounded-2xl bg-warning/10 px-3 py-2 text-xs font-semibold text-ink">
              {message}
            </p>
          ) : null}
        </Card>
      </section>

      <section>
        <SectionHeader title="Add manually" />
        <Card>
          <WardrobeTagReviewForm showName submitLabel="Create wardrobe item" disabled={isSaving || isAnalyzing} onSubmit={handleManualCreate} />
        </Card>
      </section>

      <Link href="/wardrobe" className="block text-center text-sm font-semibold text-cocoa">
        Back to wardrobe
      </Link>
    </div>
  );
}
