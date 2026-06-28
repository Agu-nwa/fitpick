"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { FabricDrape, GarmentFit, GarmentMeasurements, MeasurementSource, SizeSystem, StretchLevel, TaggedSize, WardrobeCategory, WardrobeCondition, WardrobeItem } from "@/types/wardrobe";

export type WardrobeTagFormValues = {
  name?: string;
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
  condition: WardrobeCondition;
};

const categoryOptions: Array<{ value: WardrobeCategory; label: string }> = [
  { value: "tops", label: "Tops" },
  { value: "bottoms", label: "Bottoms" },
  { value: "dresses", label: "Dresses" },
  { value: "native", label: "Native wear" },
  { value: "outerwear", label: "Outerwear" },
  { value: "shoes", label: "Shoes" },
  { value: "bags", label: "Bags" },
  { value: "accessories", label: "Accessories" }
];

const conditionOptions: Array<{ value: WardrobeCondition; label: string }> = [
  { value: "ready", label: "Ready" },
  { value: "needs-care", label: "Needs care" },
  { value: "missing-tags", label: "Needs more tags" }
];
const taggedSizeOptions: TaggedSize[] = ["unknown", "XS", "S", "M", "L", "XL", "XXL", "custom"];
const sizeSystemOptions: SizeSystem[] = ["unknown", "international", "US", "UK", "EU", "NG", "custom"];
const garmentFitOptions: GarmentFit[] = ["unknown", "slim", "regular", "relaxed", "oversized", "tailored", "flowing"];
const stretchOptions: StretchLevel[] = ["unknown", "none", "low", "medium", "high"];
const drapeOptions: FabricDrape[] = ["unknown", "structured", "soft", "flowing", "heavy", "stiff"];
const measurementSourceOptions: MeasurementSource[] = ["unknown", "label_ocr", "user_confirmed", "ai_estimated", "manual"];
const measurementKeys: Array<keyof GarmentMeasurements> = ["chestWidthCm", "shoulderWidthCm", "sleeveLengthCm", "bodyLengthCm", "waistCm", "hipsCm", "inseamCm", "outseamCm"];

const inputClass =
  "focus-ring min-h-11 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-muted";

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function joinTags(values?: string[]) {
  return (values || []).join(", ");
}

function initialValues(item?: Partial<WardrobeItem>): WardrobeTagFormValues {
  return {
    name: item?.name || "",
    category: item?.category || "tops",
    subcategory: item?.subcategory || "",
    color: item?.color || "",
    pattern: item?.pattern || "",
    fabric: item?.fabric || "",
    fit: item?.fit || "",
    formality: item?.formality || ["balanced"],
    occasions: item?.occasions || ["casual"],
    weather: item?.weather || ["dry"],
    taggedSize: item?.taggedSize || "unknown",
    sizeSystem: item?.sizeSystem || "unknown",
    garmentFit: item?.garmentFit || "unknown",
    garmentMeasurements: item?.garmentMeasurements || {},
    stretchLevel: item?.stretchLevel || "unknown",
    fabricDrape: item?.fabricDrape || "unknown",
    fitConfidence: item?.fitConfidence || 0,
    measurementSource: item?.measurementSource || "unknown",
    condition: item?.condition || "ready"
  };
}

function measurementState(measurements?: GarmentMeasurements) {
  return Object.fromEntries(measurementKeys.map((key) => [key, measurements?.[key] == null ? "" : String(measurements[key])])) as Record<string, string>;
}

function measurementNumber(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric * 10) / 10 : null;
}

export function WardrobeTagReviewForm({
  initialItem,
  showName = false,
  submitLabel = "Save tags",
  disabled = false,
  onSubmit
}: {
  initialItem?: Partial<WardrobeItem>;
  showName?: boolean;
  submitLabel?: string;
  disabled?: boolean;
  onSubmit: (values: WardrobeTagFormValues) => void | Promise<void>;
}) {
  const defaults = useMemo(() => initialValues(initialItem), [initialItem]);
  const [name, setName] = useState(defaults.name || "");
  const [category, setCategory] = useState<WardrobeCategory>(defaults.category);
  const [subcategory, setSubcategory] = useState(defaults.subcategory || "");
  const [color, setColor] = useState(defaults.color);
  const [pattern, setPattern] = useState(defaults.pattern || "");
  const [fabric, setFabric] = useState(defaults.fabric || "");
  const [fit, setFit] = useState(defaults.fit || "");
  const [formality, setFormality] = useState(joinTags(defaults.formality));
  const [occasions, setOccasions] = useState(joinTags(defaults.occasions));
  const [weather, setWeather] = useState(joinTags(defaults.weather));
  const [taggedSize, setTaggedSize] = useState<TaggedSize>(defaults.taggedSize);
  const [sizeSystem, setSizeSystem] = useState<SizeSystem>(defaults.sizeSystem);
  const [garmentFit, setGarmentFit] = useState<GarmentFit>(defaults.garmentFit);
  const [stretchLevel, setStretchLevel] = useState<StretchLevel>(defaults.stretchLevel);
  const [fabricDrape, setFabricDrape] = useState<FabricDrape>(defaults.fabricDrape);
  const [measurementSource, setMeasurementSource] = useState<MeasurementSource>(defaults.measurementSource);
  const [fitConfidence, setFitConfidence] = useState(String(defaults.fitConfidence));
  const [garmentMeasurements, setGarmentMeasurements] = useState<Record<string, string>>(measurementState(defaults.garmentMeasurements));
  const [condition, setCondition] = useState<WardrobeCondition>(defaults.condition);

  useEffect(() => {
    setName(defaults.name || "");
    setCategory(defaults.category);
    setSubcategory(defaults.subcategory || "");
    setColor(defaults.color);
    setPattern(defaults.pattern || "");
    setFabric(defaults.fabric || "");
    setFit(defaults.fit || "");
    setFormality(joinTags(defaults.formality));
    setOccasions(joinTags(defaults.occasions));
    setWeather(joinTags(defaults.weather));
    setTaggedSize(defaults.taggedSize);
    setSizeSystem(defaults.sizeSystem);
    setGarmentFit(defaults.garmentFit);
    setStretchLevel(defaults.stretchLevel);
    setFabricDrape(defaults.fabricDrape);
    setMeasurementSource(defaults.measurementSource);
    setFitConfidence(String(defaults.fitConfidence));
    setGarmentMeasurements(measurementState(defaults.garmentMeasurements));
    setCondition(defaults.condition);
  }, [defaults]);

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          name: name.trim(),
          category,
          subcategory: subcategory.trim(),
          color: color.trim(),
          pattern: pattern.trim(),
          fabric: fabric.trim(),
          fit: fit.trim(),
          formality: splitTags(formality),
          occasions: splitTags(occasions),
          weather: splitTags(weather),
          taggedSize,
          sizeSystem,
          garmentFit,
          garmentMeasurements: Object.fromEntries(measurementKeys.map((key) => [key, measurementNumber(garmentMeasurements[key] || "")])),
          stretchLevel,
          fabricDrape,
          fitConfidence: Math.max(0, Math.min(1, Number(fitConfidence) || 0)),
          measurementSource,
          condition
        });
      }}
    >
      {showName ? (
        <label className="block text-xs font-semibold text-ink">
          Item name
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="White linen shirt" required />
        </label>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-ink">
          Category
          <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value as WardrobeCategory)}>
            {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-ink">
          Color
          <input className={inputClass} value={color} onChange={(event) => setColor(event.target.value)} placeholder="Navy" required />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-ink">
          Subcategory
          <input className={inputClass} value={subcategory} onChange={(event) => setSubcategory(event.target.value)} placeholder="Shirt" />
        </label>
        <label className="block text-xs font-semibold text-ink">
          Pattern
          <input className={inputClass} value={pattern} onChange={(event) => setPattern(event.target.value)} placeholder="Plain" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-ink">
          Fabric
          <input className={inputClass} value={fabric} onChange={(event) => setFabric(event.target.value)} placeholder="Cotton" />
        </label>
        <label className="block text-xs font-semibold text-ink">
          Fit
          <input className={inputClass} value={fit} onChange={(event) => setFit(event.target.value)} placeholder="Regular" />
        </label>
      </div>

      <label className="block text-xs font-semibold text-ink">
        Formality
        <input className={inputClass} value={formality} onChange={(event) => setFormality(event.target.value)} placeholder="balanced, business" />
      </label>
      <label className="block text-xs font-semibold text-ink">
        Occasions
        <input className={inputClass} value={occasions} onChange={(event) => setOccasions(event.target.value)} placeholder="work, church, casual" />
      </label>
      <label className="block text-xs font-semibold text-ink">
        Weather
        <input className={inputClass} value={weather} onChange={(event) => setWeather(event.target.value)} placeholder="dry, indoor" />
      </label>

      <div className="rounded-2xl border border-line bg-white p-3">
        <p className="text-sm font-semibold text-ink">Fit accuracy</p>
        <p className="mt-1 text-xs leading-5 text-muted">Add measurements to improve try-on accuracy. Unknown values stay estimated.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-ink">
            Tagged size
            <select className={inputClass} value={taggedSize} onChange={(event) => setTaggedSize(event.target.value as TaggedSize)}>
              {taggedSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-ink">
            Size system
            <select className={inputClass} value={sizeSystem} onChange={(event) => setSizeSystem(event.target.value as SizeSystem)}>
              {sizeSystemOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-ink">
            Garment fit
            <select className={inputClass} value={garmentFit} onChange={(event) => setGarmentFit(event.target.value as GarmentFit)}>
              {garmentFitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-ink">
            Stretch
            <select className={inputClass} value={stretchLevel} onChange={(event) => setStretchLevel(event.target.value as StretchLevel)}>
              {stretchOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-ink">
            Drape
            <select className={inputClass} value={fabricDrape} onChange={(event) => setFabricDrape(event.target.value as FabricDrape)}>
              {drapeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-ink">
            Source
            <select className={inputClass} value={measurementSource} onChange={(event) => setMeasurementSource(event.target.value as MeasurementSource)}>
              {measurementSourceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-ink">
            Fit confidence
            <input type="number" min="0" max="1" step="0.05" className={inputClass} value={fitConfidence} onChange={(event) => setFitConfidence(event.target.value)} />
          </label>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {measurementKeys.map((key) => (
            <label key={key} className="block text-xs font-semibold text-ink">
              {key.replace("Cm", "").replace(/([A-Z])/g, " $1")} cm
              <input type="number" min="0" step="0.1" className={inputClass} value={garmentMeasurements[key] || ""} onChange={(event) => setGarmentMeasurements((current) => ({ ...current, [key]: event.target.value }))} placeholder="Unknown" />
            </label>
          ))}
        </div>
      </div>

      <label className="block text-xs font-semibold text-ink">
        Readiness
        <select className={inputClass} value={condition} onChange={(event) => setCondition(event.target.value as WardrobeCondition)}>
          {conditionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>

      <Button type="submit" className="w-full" disabled={disabled}>{submitLabel}</Button>
    </form>
  );
}
