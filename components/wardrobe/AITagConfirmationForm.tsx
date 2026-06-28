"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { ConfidenceBadge } from "@/components/wardrobe/ConfidenceBadge";
import type { WardrobeAiAnalysis } from "@/lib/ai/schemas/wardrobe-ai.schema";
import type { FabricDrape, GarmentFit, GarmentMeasurements, MeasurementSource, SizeSystem, StretchLevel, TaggedSize, WardrobeCategory } from "@/types/wardrobe";

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
  taggedSize: TaggedSize;
  sizeSystem: SizeSystem;
  garmentFit: GarmentFit;
  garmentMeasurements: GarmentMeasurements;
  stretchLevel: StretchLevel;
  fabricDrape: FabricDrape;
  fitConfidence: number;
  measurementSource: MeasurementSource;
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
const taggedSizeOptions: TaggedSize[] = ["unknown", "XS", "S", "M", "L", "XL", "XXL", "custom"];
const sizeSystemOptions: SizeSystem[] = ["unknown", "international", "US", "UK", "EU", "NG", "custom"];
const garmentFitOptions: GarmentFit[] = ["unknown", "slim", "regular", "relaxed", "oversized", "tailored", "flowing"];
const stretchOptions: StretchLevel[] = ["unknown", "none", "low", "medium", "high"];
const drapeOptions: FabricDrape[] = ["unknown", "structured", "soft", "flowing", "heavy", "stiff"];
const measurementSourceOptions: MeasurementSource[] = ["unknown", "label_ocr", "user_confirmed", "ai_estimated", "manual"];
const garmentMeasurementFields: Array<{ key: keyof GarmentMeasurements; label: string; placeholder: string }> = [
  { key: "chestWidthCm", label: "Chest width", placeholder: "52" },
  { key: "shoulderWidthCm", label: "Shoulder width", placeholder: "46" },
  { key: "sleeveLengthCm", label: "Sleeve length", placeholder: "63" },
  { key: "bodyLengthCm", label: "Body length", placeholder: "72" },
  { key: "waistCm", label: "Waist", placeholder: "84" },
  { key: "hipsCm", label: "Hips", placeholder: "98" },
  { key: "inseamCm", label: "Inseam", placeholder: "78" },
  { key: "outseamCm", label: "Outseam", placeholder: "104" },
  { key: "shoeLengthCm", label: "Shoe length", placeholder: "28" },
  { key: "heelHeightCm", label: "Heel height", placeholder: "4" }
];
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

function normalizeTaggedSize(value: unknown): TaggedSize {
  const cleaned = String(value || "").trim().toUpperCase();
  if (["XS", "S", "M", "L", "XL", "XXL"].includes(cleaned)) return cleaned as TaggedSize;
  if (cleaned && cleaned !== "UNKNOWN") return "custom";
  return "unknown";
}

function normalizeOption<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  const cleaned = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  return options.includes(cleaned as T) ? cleaned as T : fallback;
}

function measurementNumber(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric * 10) / 10 : null;
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
  const [taggedSize, setTaggedSize] = useState<TaggedSize>("unknown");
  const [sizeSystem, setSizeSystem] = useState<SizeSystem>("unknown");
  const [garmentFit, setGarmentFit] = useState<GarmentFit>("unknown");
  const [stretchLevel, setStretchLevel] = useState<StretchLevel>("unknown");
  const [fabricDrape, setFabricDrape] = useState<FabricDrape>("unknown");
  const [measurementSource, setMeasurementSource] = useState<MeasurementSource>("unknown");
  const [fitConfidence, setFitConfidence] = useState("0");
  const [garmentMeasurements, setGarmentMeasurements] = useState<Record<string, string>>({});
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
    const sizeField = aiAnalysis?.fields?.taggedSize?.value || aiAnalysis?.fields?.size?.value;
    const fitField = aiAnalysis?.fields?.garmentFit?.value || aiAnalysis?.fields?.fit?.value;
    setTaggedSize(normalizeTaggedSize(sizeField));
    setSizeSystem(normalizeOption(aiAnalysis?.fields?.sizeSystem?.value, sizeSystemOptions, "unknown"));
    setGarmentFit(normalizeOption(fitField, garmentFitOptions, "unknown"));
    setStretchLevel(normalizeOption(aiAnalysis?.fields?.stretchLevel?.value, stretchOptions, "unknown"));
    setFabricDrape(normalizeOption(aiAnalysis?.fields?.fabricDrape?.value || aiAnalysis?.fields?.silhouette?.value, drapeOptions, "unknown"));
    setMeasurementSource(aiAnalysis?.fields?.size?.source === "ocr" ? "label_ocr" : normalizeOption(aiAnalysis?.fields?.measurementSource?.value, measurementSourceOptions, "ai_estimated"));
    setFitConfidence(String(Math.max(aiAnalysis?.fields?.fit?.confidence ?? 0, aiAnalysis?.fields?.garmentFit?.confidence ?? 0).toFixed(2)));
    setGarmentMeasurements({});
  }, [aiAnalysis, initialValues]);

  function submit() {
    const itemName = name.trim();
    const category = values.category as WardrobeCategory;
    const primaryColor = values.primaryColor.trim();

    if (!itemName || !category || !primaryColor) {
      setError("Name, category, and primary color are required before saving.");
      return;
    }

    const fitConfidenceValue = Math.max(0, Math.min(1, Number(fitConfidence) || 0));
    const parsedGarmentMeasurements = Object.fromEntries(
      garmentMeasurementFields.map((field) => [field.key, measurementNumber(garmentMeasurements[field.key] || "")])
    ) as GarmentMeasurements;

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
    Object.assign(verifiedFields, {
      taggedSize: { value: taggedSize, confidence: 1, originalConfidence: aiAnalysis?.fields?.taggedSize?.confidence ?? aiAnalysis?.fields?.size?.confidence ?? 0, source: "user_confirmed" as const },
      sizeSystem: { value: sizeSystem, confidence: 1, originalConfidence: aiAnalysis?.fields?.sizeSystem?.confidence ?? 0, source: "user_confirmed" as const },
      garmentFit: { value: garmentFit, confidence: 1, originalConfidence: aiAnalysis?.fields?.garmentFit?.confidence ?? aiAnalysis?.fields?.fit?.confidence ?? 0, source: "user_confirmed" as const },
      stretchLevel: { value: stretchLevel, confidence: 1, originalConfidence: aiAnalysis?.fields?.stretchLevel?.confidence ?? 0, source: "user_confirmed" as const },
      fabricDrape: { value: fabricDrape, confidence: 1, originalConfidence: aiAnalysis?.fields?.fabricDrape?.confidence ?? 0, source: "user_confirmed" as const },
      fitConfidence: { value: fitConfidenceValue, confidence: 1, originalConfidence: aiAnalysis?.fields?.fitConfidence?.confidence ?? 0, source: "user_confirmed" as const },
      measurementSource: { value: measurementSource, confidence: 1, originalConfidence: aiAnalysis?.fields?.measurementSource?.confidence ?? 0, source: "user_confirmed" as const }
    });

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
      taggedSize,
      sizeSystem,
      garmentFit,
      garmentMeasurements: parsedGarmentMeasurements,
      stretchLevel,
      fabricDrape,
      fitConfidence: fitConfidenceValue,
      measurementSource,
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

      <section className="rounded-2xl border border-line bg-white p-3">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-ink">Fit accuracy</h3>
          <p className="mt-1 text-xs leading-5 text-muted">Add measurements to improve try-on accuracy. If you do not know measurements, FitPick will treat fit as estimated.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldGroup label="Tagged size" htmlFor="fit-tagged-size">
            <select id="fit-tagged-size" className={inputClass} value={taggedSize} onChange={(event) => setTaggedSize(event.target.value as TaggedSize)}>
              {taggedSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Size system" htmlFor="fit-size-system">
            <select id="fit-size-system" className={inputClass} value={sizeSystem} onChange={(event) => setSizeSystem(event.target.value as SizeSystem)}>
              {sizeSystemOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Garment fit" htmlFor="fit-garment-fit">
            <select id="fit-garment-fit" className={inputClass} value={garmentFit} onChange={(event) => setGarmentFit(event.target.value as GarmentFit)}>
              {garmentFitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Stretch" htmlFor="fit-stretch">
            <select id="fit-stretch" className={inputClass} value={stretchLevel} onChange={(event) => setStretchLevel(event.target.value as StretchLevel)}>
              {stretchOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Fabric drape" htmlFor="fit-drape">
            <select id="fit-drape" className={inputClass} value={fabricDrape} onChange={(event) => setFabricDrape(event.target.value as FabricDrape)}>
              {drapeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Measurement source" htmlFor="fit-source">
            <select id="fit-source" className={inputClass} value={measurementSource} onChange={(event) => setMeasurementSource(event.target.value as MeasurementSource)}>
              {measurementSourceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Fit confidence" htmlFor="fit-confidence" help="0 to 1. Manual measurements can be higher; visual estimates should stay conservative.">
            <input id="fit-confidence" type="number" min="0" max="1" step="0.05" className={inputClass} value={fitConfidence} onChange={(event) => setFitConfidence(event.target.value)} />
          </FieldGroup>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {garmentMeasurementFields.map((field) => (
            <FieldGroup key={field.key} label={`${field.label} (cm)`} htmlFor={`fit-${field.key}`}>
              <input
                id={`fit-${field.key}`}
                type="number"
                min="0"
                step="0.1"
                className={inputClass}
                value={garmentMeasurements[field.key] || ""}
                onChange={(event) => setGarmentMeasurements((current) => ({ ...current, [field.key]: event.target.value }))}
                placeholder={field.placeholder}
              />
            </FieldGroup>
          ))}
        </div>
      </section>

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
