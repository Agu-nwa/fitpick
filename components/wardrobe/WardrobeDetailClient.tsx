"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { CTABar } from "@/components/ui/CTABar";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { WardrobeItemCard } from "@/components/wardrobe/WardrobeItemCard";
import {
  WardrobeApiErrorState,
  WardrobeAuthRequiredState,
  WardrobeBackendUnavailableState,
  WardrobeLoadingState,
  WardrobeSaveSuccessState
} from "@/components/wardrobe/WardrobeIntegrationStates";
import { WardrobeTagReviewForm, type WardrobeTagFormValues } from "@/components/wardrobe/WardrobeTagReviewForm";
import { useSession } from "@/hooks/use-session";
import { archiveWardrobeItem, getWardrobeItem, updateWardrobeItem, updateWardrobeTags } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { WardrobeItem } from "@/types/wardrobe";

function tagPayload(values: WardrobeTagFormValues) {
  return {
    category: values.category,
    subcategory: values.subcategory || "",
    color: values.color,
    pattern: values.pattern || "",
    fabric: values.fabric || "",
    fit: values.fit || "",
    formality: values.formality,
    occasions: values.occasions,
    weather: values.weather,
    taggedSize: values.taggedSize,
    sizeSystem: values.sizeSystem,
    garmentFit: values.garmentFit,
    garmentMeasurements: values.garmentMeasurements,
    stretchLevel: values.stretchLevel,
    fabricDrape: values.fabricDrape,
    fitConfidence: values.fitConfidence,
    measurementSource: values.measurementSource,
    condition: values.condition
  };
}

function ItemDetails({ item }: { item: WardrobeItem }) {
  const status = item.condition === "needs-care" ? "Needs care" : item.condition === "missing-tags" ? "Needs more tags" : "Ready";
  const imageTone = item.imageTone || "from-stone-100 to-stone-300";
  const imageUrl = item.thumbnailUrl || item.imageUrl;

  return (
    <>
      <div
        className={cn("h-80 rounded-[2rem] border border-line bg-gradient-to-br bg-cover bg-center shadow-soft", imageTone)}
        style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
        role="img"
        aria-label={item.name}
      />

      <section className="mt-7">
        <SectionHeader title="Item tags" />
        <Card>
          <div className="flex flex-wrap gap-2">
            <Chip active>{item.category}</Chip>
            {item.color ? <Chip>{item.color}</Chip> : null}
            {item.pattern ? <Chip>{item.pattern}</Chip> : null}
            {item.fabric ? <Chip>{item.fabric}</Chip> : null}
            {item.fit ? <Chip>{item.fit}</Chip> : null}
            {item.taggedSize && item.taggedSize !== "unknown" ? <Chip>Size {item.taggedSize}</Chip> : null}
            {item.garmentFit && item.garmentFit !== "unknown" ? <Chip>{item.garmentFit} fit</Chip> : null}
            {item.fabricDrape && item.fabricDrape !== "unknown" ? <Chip>{item.fabricDrape} drape</Chip> : null}
            <Chip>{status}</Chip>
            {item.lastWorn ? <Chip>Last worn: {item.lastWorn}</Chip> : null}
          </div>
        </Card>
      </section>

      <section className="mt-7">
        <SectionHeader title="Works for" />
        <Card>
          <div className="flex flex-wrap gap-2">
            {(item.occasions.length ? item.occasions : ["Add occasions"]).map((occasion) => <Chip key={occasion}>{occasion}</Chip>)}
          </div>
        </Card>
      </section>

      <section className="mt-7">
        <SectionHeader title="Weather fit" />
        <Card>
          <div className="flex flex-wrap gap-2">
            {(item.weather.length ? item.weather : ["Add weather tags"]).map((weather) => <Chip key={weather}>{weather}</Chip>)}
          </div>
        </Card>
      </section>
    </>
  );
}

export function WardrobeDetailClient({ id, mockItem }: { id: string; mockItem?: WardrobeItem }) {
  const session = useSession();
  const router = useRouter();
  const [item, setItem] = useState<WardrobeItem | null>(mockItem || null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "not-found" | "unavailable" | "error">("idle");
  const [isEditable, setIsEditable] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadItem = useCallback(async () => {
    setStatus("loading");
    const result = await getWardrobeItem(id);
    if (result.ok) {
      setItem(result.data.item);
      setIsEditable(true);
      setStatus("ready");
      return;
    }

    if (mockItem) {
      setItem(mockItem);
      setIsEditable(false);
      setStatus(result.error.code === "INTERNAL_ERROR" ? "unavailable" : "ready");
      return;
    }

    setItem(null);
    setIsEditable(false);
    setStatus(result.error.code === "NOT_FOUND" ? "not-found" : result.error.code === "INTERNAL_ERROR" ? "unavailable" : "error");
  }, [id, mockItem]);

  useEffect(() => {
    if (session.status === "authenticated") void loadItem();
  }, [loadItem, session.status]);

  async function handleUpdate(values: WardrobeTagFormValues) {
    setIsSaving(true);
    setNotice(null);
    const result = await updateWardrobeItem(id, { ...tagPayload(values), name: values.name || item?.name });
    setIsSaving(false);

    if (result.ok) {
      setItem(result.data.item);
      setIsEditable(true);
      setNotice("Item details saved.");
      return;
    }

    setStatus(result.error.code === "INTERNAL_ERROR" ? "unavailable" : "error");
  }

  async function handleTagUpdate(values: WardrobeTagFormValues) {
    setIsSaving(true);
    setNotice(null);
    const result = await updateWardrobeTags(id, tagPayload(values));
    setIsSaving(false);

    if (result.ok) {
      setItem(result.data.item);
      setIsEditable(true);
      setNotice("Tags saved.");
      return;
    }

    setStatus(result.error.code === "INTERNAL_ERROR" ? "unavailable" : "error");
  }

  async function handleArchive() {
    setIsSaving(true);
    setNotice(null);
    const result = await archiveWardrobeItem(id);
    setIsSaving(false);

    if (result.ok) {
      router.push("/wardrobe");
      return;
    }

    setStatus(result.error.code === "INTERNAL_ERROR" ? "unavailable" : "error");
  }

  if (session.status === "loading" || status === "loading" || (session.status === "authenticated" && status === "idle" && !mockItem)) {
    return <WardrobeLoadingState />;
  }

  if (session.status === "logged-out") {
    return (
      <>
        <WardrobeAuthRequiredState />
        {mockItem ? (
          <section className="mt-7">
            <SectionHeader title="Wardrobe preview" />
            <WardrobeItemCard item={mockItem} />
          </section>
        ) : null}
      </>
    );
  }

  if (session.status === "backend-unavailable" || status === "unavailable") {
    return (
      <>
        <WardrobeBackendUnavailableState onRetry={session.status === "backend-unavailable" ? session.refresh : loadItem} />
        {mockItem ? <ItemDetails item={mockItem} /> : null}
      </>
    );
  }

  if (status === "not-found" || !item) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">Item not found</p>
        <p className="mt-2 text-xs leading-5 text-muted">This wardrobe item is not available.</p>
        <Link href="/wardrobe">
          <Button className="mt-4 w-full">Back to wardrobe</Button>
        </Link>
      </Card>
    );
  }

  if (status === "error") return <WardrobeApiErrorState onRetry={loadItem} />;

  return (
    <>
      {notice ? <WardrobeSaveSuccessState title={notice} body={`${item.name} is up to date.`} /> : null}
      <ItemDetails item={item} />

      {!isEditable ? (
        <Card className="mt-7 p-4">
          <p className="text-sm font-semibold text-ink">Preview item</p>
          <p className="mt-2 text-xs leading-5 text-muted">Sign in with a saved wardrobe item to edit tags or archive it.</p>
          <Link href="/wardrobe/add">
            <Button className="mt-4 w-full">Add similar</Button>
          </Link>
        </Card>
      ) : null}

      {isEditable ? <section className="mt-7">
        <SectionHeader title="Edit item" />
        <Card>
          <WardrobeTagReviewForm initialItem={item} showName submitLabel="Save item" disabled={isSaving} onSubmit={handleUpdate} />
        </Card>
      </section> : null}

      {isEditable ? <section className="mt-7">
        <SectionHeader title="Review tags" />
        <Card>
          <WardrobeTagReviewForm initialItem={item} submitLabel="Save tags" disabled={isSaving} onSubmit={handleTagUpdate} />
        </Card>
      </section> : null}

      {isEditable ? <CTABar className="mt-6 grid grid-cols-2 gap-2">
        <Button variant="danger" onClick={() => void handleArchive()} disabled={isSaving}>Archive item</Button>
        <Link href="/wardrobe/add">
          <Button variant="secondary" className="w-full">Add similar</Button>
        </Link>
      </CTABar> : null}
    </>
  );
}
