"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfidenceBadge } from "@/components/wardrobe/ConfidenceBadge";
import type { WardrobeAiAnalysis } from "@/lib/ai/schemas/wardrobe-ai.schema";
import type { WardrobeCategory } from "@/types/wardrobe";

type FieldKind = "text" | "list" | "category";

type FieldConfig = {
  key: string;
  label: string;
  kind?: FieldKind;
  required?: boolean;
};

export type AITagConfirmationValues = {
  name: string;
  category: WardrobeCategory;
  subcategory?: string;
  color: string;
  pattern?: string;
  fabric?: string;
  fit?: string;
  formality: string[];
  occasions: string[];
  weather: string[];
  condition: "ready" | "needs-care" | "missing-tags";
  verifiedFields: Record<string, { value: string | string[] | null; confidence: number; originalConfidence: number; source: "user_confirmed" }>;
};

const fields: FieldConfig[] = [
  { key: "garmentType", label: "Garment type", required: true },
  { key: "category", label: "Category", kind: "category", required: true },
  { key: "subcategory", label: "Subcategory" },
  { key: "primaryColor", label: "Primary color", required: true },
  { key: "secondaryColors", label: "Secondary colors", kind: "list" },
  { key: "pattern", label: "Pattern" },
  { key: "fabricEstimate", label: "Fabric estimate" },
  { key: "fabricComposition", label: "Fabric composition" },
  { key: "size", label: "Size" },
  { key: "brand", label: "Brand" },
  { key: "fit", label: "Fit" },
  { key: "silhouette", label: "Silhouette" },
  { key: "sleeveLength", label: "Sleeve length" },
  { key: "necklineCollar", label: "Neckline / collar" },
  { key: "length", label: "Length" },
  { key: "texture", label: "Texture" },
  { key: "thicknessEstimate", label: "Thickness estimate" },
  { key: "layeringSuitability", label: "Layering suitability" },
  { key: "formalityScore", label: "Formality score" },
  { key: "luxuryScore", label: "Luxury score" },
  { key: "weatherSuitability", label: "Weather suitability", kind: "list" },
  { key: "seasonSuitability", label: "Season suitability", kind: "list" },
  { key: "occasionSuitability", label: "Occasion suitability", kind: "list" },
  { key: "culturalTraditionalRelevance", label: "Cultural relevance" },
  { key: "careInstructions", label: "Care instructions", kind: "list" },
  { key: "stylingNotes", label: "Styling notes", kind: "list" }
];

const categoryOptions: WardrobeCategory[] = ["tops", "bottoms", "dresses", "native", "outerwear", "shoes", "bags", "accessories"];
const inputClass =
  "focus-ring min-h-11 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-muted";

function stringifyValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return "";
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function clampScore(key: string, value: string) {
  if (key !== "formalityScore" && key !== "luxuryScore") return value.trim();
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value.trim();
  return String(Math.max(0, Math.min(numeric > 1 ? 10 : 1, numeric)));
}

function sourceLabel(source?: string) {
  if (source === "ocr") return "OCR";
  if (source === "vision") return "Vision";
  if (source === "system_inferred") return "System";
  if (source === "user_confirmed") return "Confirmed";
  return "Unknown";
}

export function AITagConfirmationForm({
  aiAnalysis,
  disabled = false,
  onSubmit
}: {
  aiAnalysis?: WardrobeAiAnalysis | null;
  disabled?: boolean;
  onSubmit: (values: AITagConfirmationValues) => void | Promise<void>;
}) {
  const initialValues = useMemo(
    () =>
      Object.fromEntries(
        fields.map((field) => [field.key, stringifyValue(aiAnalysis?.fields?.[field.key as keyof typeof aiAnalysis.fields]?.value)])
      ) as Record<string, string>,
    [aiAnalysis]
  );
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [error, setError] = useState("");

  useEffect(() => {
    const next = initialValues;
    setValues(next);
    setName([next.primaryColor, next.garmentType].filter(Boolean).join(" ").trim());
  }, [initialValues]);

  function submit() {
    const itemName = name.trim();
    const category = values.category as WardrobeCategory;
    const primaryColor = values.primaryColor.trim();

    if (!itemName || !category || !primaryColor) {
      setError("Name, category, and primary color are required before saving.");
      return;
    }

    const verifiedFields = Object.fromEntries(
      fields.map((field) => {
        const original = aiAnalysis?.fields?.[field.key as keyof typeof aiAnalysis.fields] as any;
        const value = field.kind === "list" ? splitList(values[field.key] || "") : clampScore(field.key, values[field.key] || "") || null;
        return [
          field.key,
          {
            value,
            confidence: 1,
            originalConfidence: original?.confidence ?? 0,
            source: "user_confirmed" as const
          }
        ];
      })
    );

    void onSubmit({
      name: itemName,
      category,
      subcategory: values.subcategory.trim(),
      color: primaryColor,
      pattern: values.pattern.trim(),
      fabric: values.fabricComposition.trim() || values.fabricEstimate.trim(),
      fit: values.fit.trim(),
      formality: values.formalityScore ? [values.formalityScore.trim()] : [],
      occasions: splitList(values.occasionSuitability),
      weather: splitList(values.weatherSuitability),
      condition: "ready",
      verifiedFields
    });
  }

  if (!aiAnalysis) {
    return (
      <div className="space-y-3">
        <p className="rounded-2xl bg-warning/10 px-3 py-2 text-xs font-semibold text-ink">
          AI suggestions are not available. Run analysis again or add this item manually.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="block text-xs font-semibold text-ink">
        Item name
        <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="White cotton shirt" required />
      </label>

      {error ? <p className="rounded-2xl bg-danger/10 px-3 py-2 text-xs font-semibold text-ink">{error}</p> : null}

      <div className="space-y-3">
        {fields.map((field) => {
          const aiField = aiAnalysis.fields[field.key as keyof typeof aiAnalysis.fields] as any;
          const lowConfidence = (aiField?.confidence ?? 0) < 0.65;

          return (
            <div key={field.key} className="rounded-2xl border border-line bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-ink">{field.label}{field.required ? " *" : ""}</p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{sourceLabel(aiField?.source)}</p>
                </div>
                <ConfidenceBadge confidence={aiField?.confidence ?? 0} />
              </div>
              {field.kind === "category" ? (
                <select className={inputClass} value={values[field.key] || "tops"} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}>
                  {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : field.kind === "list" ? (
                <textarea
                  className={`${inputClass} min-h-20`}
                  value={values[field.key] || ""}
                  onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                  placeholder="Comma-separated values"
                />
              ) : (
                <input
                  className={inputClass}
                  value={values[field.key] || ""}
                  onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                  placeholder={field.required ? "Required" : "Unknown"}
                  required={field.required}
                />
              )}
              {lowConfidence ? <p className="mt-2 text-[11px] font-semibold text-warning">Low confidence — please verify</p> : null}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={submit} disabled={disabled}>
          Confirm all
        </Button>
        <Button type="submit" disabled={disabled}>
          Save verified item
        </Button>
      </div>
    </form>
  );
}
