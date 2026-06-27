"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldGroup } from "@/components/ui/FieldGroup";
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
  verifiedFields: Record<string, { value: string | string[] | number | null; confidence: number; originalConfidence: number; source: "user_confirmed" }>;
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
  { key: "recognizedEntity", label: "Recognized entity" },
  { key: "entityType", label: "Entity type" },
  { key: "entityConfidence", label: "Entity confidence" },
  { key: "sportCategory", label: "Sport category" },
  { key: "teamOrNation", label: "Team or nation" },
  { key: "clubOrFederation", label: "Club or federation" },
  { key: "playerName", label: "Player name" },
  { key: "playerNumber", label: "Player number" },
  { key: "kitType", label: "Kit type" },
  { key: "seasonEstimate", label: "Season estimate" },
  { key: "logoDetections", label: "Logo detections", kind: "list" },
  { key: "textDetections", label: "Visible text detections", kind: "list" },
  { key: "brandSignals", label: "Brand signals", kind: "list" },
  { key: "entityWarnings", label: "Entity warnings", kind: "list" },
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

const fieldGroups: Array<{ title: string; body: string; keys: string[] }> = [
  {
    title: "Identity",
    body: "Core information FitPick uses to find this item quickly.",
    keys: ["garmentType", "category", "subcategory", "brand", "size", "recognizedEntity"]
  },
  {
    title: "Advanced recognition",
    body: "Sportswear, team, logo, brand, and native/traditional signals. FitPick is not fully certain — please verify.",
    keys: ["entityType", "entityConfidence", "sportCategory", "teamOrNation", "clubOrFederation", "playerName", "playerNumber", "kitType", "seasonEstimate", "logoDetections", "textDetections", "brandSignals", "entityWarnings"]
  },
  {
    title: "Color and Pattern",
    body: "These fields drive color harmony and outfit balance.",
    keys: ["primaryColor", "secondaryColors", "pattern"]
  },
  {
    title: "Fabric and Label",
    body: "Label and fabric intelligence improve care, comfort, and weather recommendations.",
    keys: ["fabricEstimate", "fabricComposition", "texture", "thicknessEstimate", "careInstructions"]
  },
  {
    title: "Fit and Silhouette",
    body: "Shape details help FitPick build cleaner proportions.",
    keys: ["fit", "silhouette", "sleeveLength", "necklineCollar", "length", "layeringSuitability"]
  },
  {
    title: "Occasion and Season",
    body: "Use these to tune church, wedding, work, travel, and cultural styling.",
    keys: ["formalityScore", "luxuryScore", "weatherSuitability", "seasonSuitability", "occasionSuitability", "culturalTraditionalRelevance"]
  },
  {
    title: "Styling",
    body: "Short notes FitPick can use when explaining future outfits.",
    keys: ["stylingNotes"]
  }
];

const fieldsByKey = new Map(fields.map((field) => [field.key, field]));

function isFieldConfig(field: FieldConfig | undefined): field is FieldConfig {
  return Boolean(field);
}

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
  if (source === "logo_detection") return "Logo";
  if (source === "entity_resolver") return "Resolver";
  if (source === "system_inferred") return "System";
  if (source === "user_confirmed") return "Confirmed";
  return "Unknown";
}

function sourceTone(source?: string) {
  if (source === "ocr") return "info" as const;
  if (source === "logo_detection") return "info" as const;
  if (source === "entity_resolver") return "warning" as const;
  if (source === "vision") return "premium" as const;
  if (source === "user_confirmed") return "success" as const;
  if (source === "system_inferred") return "neutral" as const;
  return "warning" as const;
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
  const lowConfidenceCount = useMemo(() => {
    if (!aiAnalysis?.fields) return 0;
    return fields.filter((field) => {
      const aiField = aiAnalysis.fields[field.key as keyof typeof aiAnalysis.fields] as any;
      return (aiField?.confidence ?? 0) < 0.65;
    }).length;
  }, [aiAnalysis]);

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
      <div className="rounded-2xl border border-line bg-white p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">Confirm what FitPick detected</p>
            <p className="mt-1 text-xs leading-5 text-muted">Edits become the trusted wardrobe source.</p>
          </div>
          <Badge tone={lowConfidenceCount ? "warning" : "success"}>
            {lowConfidenceCount ? `${lowConfidenceCount} to verify` : "Ready to save"}
          </Badge>
        </div>
        <FieldGroup label="Item name" htmlFor="ai-field-name" required>
          <input id="ai-field-name" className={inputClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="White cotton shirt" required />
        </FieldGroup>
      </div>

      {error ? <p className="rounded-2xl bg-danger/10 px-3 py-2 text-xs font-semibold text-ink">{error}</p> : null}

      <div className="space-y-4">
        {fieldGroups.map((group) => (
          <section key={group.title} className="rounded-2xl border border-line bg-white p-3">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-ink">{group.title}</h3>
              <p className="mt-1 text-xs leading-5 text-muted">{group.body}</p>
            </div>
            <div className="space-y-3">
              {group.keys.map((key) => fieldsByKey.get(key)).filter(isFieldConfig).map((field) => {
                const aiField = aiAnalysis.fields[field.key as keyof typeof aiAnalysis.fields] as any;
                const lowConfidence = (aiField?.confidence ?? 0) < 0.65;
                const fieldId = `ai-field-${field.key}`;

                return (
                  <FieldGroup
                    key={field.key}
                    label={field.label}
                    htmlFor={fieldId}
                    required={field.required}
                    meta={
                      <div className="flex max-w-full flex-wrap justify-end gap-1.5">
                        <Badge tone={sourceTone(aiField?.source)}>{sourceLabel(aiField?.source)}</Badge>
                        <ConfidenceBadge confidence={aiField?.confidence ?? 0} />
                      </div>
                    }
                    help={lowConfidence ? "Low confidence — please verify" : undefined}
                  >
                    {field.kind === "category" ? (
                      <select id={fieldId} className={inputClass} value={values[field.key] || "tops"} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}>
                        {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : field.kind === "list" ? (
                      <textarea
                        id={fieldId}
                        className={`${inputClass} min-h-20`}
                        value={values[field.key] || ""}
                        onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                        placeholder="Comma-separated values"
                      />
                    ) : (
                      <input
                        id={fieldId}
                        className={inputClass}
                        value={values[field.key] || ""}
                        onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                        placeholder={field.required ? "Required" : "Unknown"}
                        required={field.required}
                      />
                    )}
                  </FieldGroup>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
