import type { DedicatedLabelExtraction } from "@/lib/ai/ocr-label-extraction";
import {
  aiListFieldSchema,
  aiNumberFieldSchema,
  aiTextFieldSchema,
  type WardrobeAiAnalysis
} from "@/lib/ai/schemas/wardrobe-ai.schema";

type EntityRecognition = {
  recognizedEntity: string | null;
  entityType: string | null;
  entityConfidence: number | null;
  sportCategory: string | null;
  teamOrNation: string | null;
  clubOrFederation: string | null;
  playerName: string | null;
  playerNumber: string | null;
  kitType: "home" | "away" | "third" | "training" | "unknown";
  seasonEstimate: string | null;
  logoDetections: string[];
  textDetections: string[];
  brandSignals: string[];
  entityWarnings: string[];
};

const sportsEntities = [
  {
    match: /\bportugal\b|\bportuguese\b|\bsele[cç][aã]o\b/i,
    entity: "Portugal National Team Jersey",
    teamOrNation: "Portugal",
    clubOrFederation: "Portugal National Team",
    type: "national_team_kit"
  },
  {
    match: /\bmanchester united\b|\bman utd\b|\bmun\b|\bunited\b/i,
    entity: "Manchester United Jersey",
    teamOrNation: null,
    clubOrFederation: "Manchester United",
    type: "club_kit"
  },
  {
    match: /\bchelsea\b|\bcfc\b/i,
    entity: "Chelsea Jersey",
    teamOrNation: null,
    clubOrFederation: "Chelsea FC",
    type: "club_kit"
  },
  {
    match: /\bnigeria\b|\bsuper eagles\b|\bng\b/i,
    entity: "Nigerian Super Eagles Jersey",
    teamOrNation: "Nigeria",
    clubOrFederation: "Nigeria Super Eagles",
    type: "national_team_kit"
  }
] as const;

const brandPatterns = [
  ["Nike", /\bnike\b|\bswoosh\b/i],
  ["Adidas", /\badidas\b|\bthree stripes\b|\b3 stripes\b/i],
  ["Puma", /\bpuma\b/i],
  ["Gucci", /\bgucci\b/i],
  ["Louis Vuitton", /\blouis vuitton\b|\blv\b/i],
  ["Chanel", /\bchanel\b/i],
  ["Dior", /\bdior\b/i],
  ["Prada", /\bprada\b/i],
  ["Versace", /\bversace\b/i],
  ["Burberry", /\bburberry\b/i],
  ["Balenciaga", /\bbalenciaga\b/i],
  ["Hermes", /\bherm[eè]s\b|\bhermes\b/i]
] as const;

const culturalPatterns = [
  ["Agbada", /\bagbada\b/i],
  ["Senator wear", /\bsenator\b/i],
  ["Kaftan", /\bkaftan\b|\bcaftan\b/i],
  ["Isiagu", /\bisiagu\b/i],
  ["Ankara", /\bankara\b/i],
  ["Aso-ebi", /\baso[-\s]?ebi\b/i],
  ["Aso-oke", /\baso[-\s]?oke\b/i],
  ["Lace native wear", /\blace\b/i],
  ["Native wear", /\bnative\b|\btraditional\b/i]
] as const;

function clean(value: unknown): string {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean).join(" ");
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim();
}

function fieldValue(analysis: WardrobeAiAnalysis, key: keyof WardrobeAiAnalysis["fields"]) {
  return clean((analysis.fields[key] as any)?.value);
}

function listField(analysis: WardrobeAiAnalysis, key: keyof WardrobeAiAnalysis["fields"]) {
  const value = (analysis.fields[key] as any)?.value;
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function uniq(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 20);
}

function evidenceText(analysis: WardrobeAiAnalysis, ocrResult?: DedicatedLabelExtraction) {
  return [
    analysis.rawSummary,
    fieldValue(analysis, "garmentType"),
    fieldValue(analysis, "category"),
    fieldValue(analysis, "subcategory"),
    fieldValue(analysis, "brand"),
    fieldValue(analysis, "primaryColor"),
    fieldValue(analysis, "pattern"),
    fieldValue(analysis, "fabricEstimate"),
    fieldValue(analysis, "culturalTraditionalRelevance"),
    listField(analysis, "logoDetections").join(" "),
    listField(analysis, "textDetections").join(" "),
    listField(analysis, "brandSignals").join(" "),
    fieldValue(analysis, "rawLabelText"),
    ocrResult?.rawLabelText?.value,
    ocrResult?.brand?.value
  ].map(clean).join(" ");
}

function isJerseyLike(analysis: WardrobeAiAnalysis, evidence: string) {
  const category = fieldValue(analysis, "category").toLowerCase();
  const garment = [
    fieldValue(analysis, "garmentType"),
    fieldValue(analysis, "subcategory"),
    evidence
  ].join(" ").toLowerCase();

  return category === "tops" && /\bjersey\b|\bkit\b|\bfootball\b|\bsoccer\b|\bsportswear\b|\btraining\b|\bnational team\b|\bclub\b/.test(garment);
}

function inferKitType(evidence: string, colors: string[]) {
  const text = evidence.toLowerCase();
  if (/\btraining\b|\btraining top\b/.test(text)) return "training" as const;
  if (/\bthird\b|\bthird kit\b/.test(text)) return "third" as const;
  if (/\baway\b|\baway kit\b/.test(text)) return "away" as const;
  if (/\bhome\b|\bhome kit\b/.test(text)) return "home" as const;
  if (colors.some((color) => /red|green|blue|white/.test(color.toLowerCase()))) return "unknown" as const;
  return "unknown" as const;
}

function extractPlayerSignals(evidence: string) {
  const playerNumber = evidence.match(/\b([1-9][0-9]?)\b/)?.[1] || null;
  const nameMatch = evidence.match(/\b([A-Z][A-Z.'-]{2,}(?:\s+[A-Z][A-Z.'-]{2,})?)\b/);
  const blocked = new Set(["PORTUGAL", "NIGERIA", "CHELSEA", "NIKE", "ADIDAS", "PUMA"]);
  const playerName = nameMatch && !blocked.has(nameMatch[1]) ? nameMatch[1] : null;
  return { playerName, playerNumber };
}

export function extractBrandSignals(fields: WardrobeAiAnalysis["fields"]) {
  const text = [
    clean(fields.brand?.value),
    clean(fields.rawLabelText?.value),
    clean(fields.logoDetections?.value),
    clean(fields.textDetections?.value),
    clean(fields.brandSignals?.value)
  ].join(" ");

  return uniq(brandPatterns.filter(([, pattern]) => pattern.test(text)).map(([brand]) => brand));
}

export function extractSportswearSignals(fields: WardrobeAiAnalysis["fields"]) {
  const text = [
    clean(fields.garmentType?.value),
    clean(fields.subcategory?.value),
    clean(fields.rawLabelText?.value),
    clean(fields.logoDetections?.value),
    clean(fields.textDetections?.value),
    clean(fields.brandSignals?.value)
  ].join(" ");

  return uniq([
    /\bfootball\b|\bsoccer\b|\bjersey\b|\bkit\b/i.test(text) ? "football" : "",
    /\btraining\b/i.test(text) ? "training" : ""
  ]);
}

export function extractCulturalSignals(fields: WardrobeAiAnalysis["fields"]) {
  const text = [
    clean(fields.category?.value),
    clean(fields.garmentType?.value),
    clean(fields.subcategory?.value),
    clean(fields.pattern?.value),
    clean(fields.fabricEstimate?.value),
    clean(fields.culturalTraditionalRelevance?.value),
    clean(fields.textDetections?.value)
  ].join(" ");

  return uniq(culturalPatterns.filter(([, pattern]) => pattern.test(text)).map(([label]) => label));
}

function defaultRecognition(): EntityRecognition {
  return {
    recognizedEntity: null,
    entityType: null,
    entityConfidence: null,
    sportCategory: null,
    teamOrNation: null,
    clubOrFederation: null,
    playerName: null,
    playerNumber: null,
    kitType: "unknown",
    seasonEstimate: null,
    logoDetections: [],
    textDetections: [],
    brandSignals: [],
    entityWarnings: []
  };
}

export function resolveGarmentEntity(analysis: WardrobeAiAnalysis, ocrResult?: DedicatedLabelExtraction): EntityRecognition {
  const evidence = evidenceText(analysis, ocrResult);
  const colors = [fieldValue(analysis, "primaryColor"), ...listField(analysis, "secondaryColors")].filter(Boolean);
  const existingTextDetections = listField(analysis, "textDetections");
  const brandSignals = uniq([...listField(analysis, "brandSignals"), ...extractBrandSignals(analysis.fields)]);
  const culturalSignals = extractCulturalSignals(analysis.fields);
  const jerseyLike = isJerseyLike(analysis, evidence);
  const recognition = defaultRecognition();
  recognition.brandSignals = brandSignals;
  recognition.logoDetections = listField(analysis, "logoDetections");
  recognition.textDetections = uniq([
    ...existingTextDetections,
    ...sportsEntities
      .filter((entity) => entity.match.test(evidence))
      .map((entity) => {
        const matched = entity as { teamOrNation: string | null; clubOrFederation: string | null; entity: string };
        return matched.teamOrNation || matched.clubOrFederation || matched.entity;
      }),
    ...brandSignals
  ]);

  const sportsEntity = sportsEntities.find((entity) => entity.match.test(evidence));
  if (sportsEntity && jerseyLike) {
    const hasBrand = brandSignals.some((brand) => /nike|adidas|puma/i.test(brand));
    const hasFootballSignal = /\bfootball\b|\bsoccer\b|\bjersey\b|\bkit\b|\bnational team\b|\bclub\b/i.test(evidence);
    const confidence = Math.min(0.93, 0.58 + (hasFootballSignal ? 0.15 : 0) + (hasBrand ? 0.08 : 0) + (colors.length ? 0.05 : 0));
    const player = extractPlayerSignals(evidence);

    return {
      ...recognition,
      recognizedEntity: sportsEntity.entity,
      entityType: sportsEntity.type,
      entityConfidence: Number(confidence.toFixed(2)),
      sportCategory: "football",
      teamOrNation: sportsEntity.teamOrNation,
      clubOrFederation: sportsEntity.clubOrFederation,
      playerName: player.playerName,
      playerNumber: player.playerNumber,
      kitType: inferKitType(evidence, colors),
      entityWarnings: confidence < 0.75 ? ["FitPick is not fully certain — please verify the team or nation."] : []
    };
  }

  if (sportsEntity && !jerseyLike) {
    recognition.entityWarnings.push("Sports text was visible, but the garment did not look enough like a jersey or kit to classify confidently.");
  }

  if (!recognition.recognizedEntity && culturalSignals.length) {
    const primary = culturalSignals[0];
    const confidence = Math.min(0.86, 0.58 + (fieldValue(analysis, "category") === "native" ? 0.16 : 0) + (culturalSignals.length > 1 ? 0.08 : 0));
    recognition.recognizedEntity = primary;
    recognition.entityType = "native_traditional_garment";
    recognition.entityConfidence = Number(confidence.toFixed(2));
    recognition.entityWarnings = confidence < 0.72 ? ["FitPick is not fully certain — please verify the traditional garment type."] : [];
  }

  if (!recognition.recognizedEntity && brandSignals.length) {
    recognition.entityType = brandSignals.some((brand) => /gucci|louis vuitton|chanel|dior|prada|versace|burberry|balenciaga|hermes/i.test(brand))
      ? "luxury_brand_item"
      : "branded_sportswear";
    recognition.entityConfidence = 0.62;
    recognition.entityWarnings = ["Visible brand signals were detected, but FitPick is not fully certain — please verify."];
  }

  return recognition;
}

function textField(value: string | null, confidence: number) {
  return aiTextFieldSchema.parse({ value, confidence, source: "entity_resolver" });
}

function listFieldValue(value: string[], confidence: number, source: "logo_detection" | "ocr" | "entity_resolver" = "entity_resolver") {
  return aiListFieldSchema.parse({ value, confidence, source });
}

export function serializeEntityRecognition(result: EntityRecognition) {
  const confidence = result.entityConfidence ?? 0;
  return {
    recognizedEntity: textField(result.recognizedEntity, confidence),
    entityType: textField(result.entityType, confidence),
    entityConfidence: aiNumberFieldSchema.parse({ value: result.entityConfidence, confidence, source: "entity_resolver" }),
    sportCategory: textField(result.sportCategory, confidence),
    teamOrNation: textField(result.teamOrNation, confidence),
    clubOrFederation: textField(result.clubOrFederation, confidence),
    playerName: textField(result.playerName, result.playerName ? Math.max(0.45, confidence - 0.15) : 0),
    playerNumber: textField(result.playerNumber, result.playerNumber ? Math.max(0.45, confidence - 0.15) : 0),
    kitType: aiTextFieldSchema.parse({ value: result.kitType, confidence: result.kitType === "unknown" ? 0 : confidence, source: "entity_resolver" }),
    seasonEstimate: textField(result.seasonEstimate, 0),
    logoDetections: listFieldValue(result.logoDetections, result.logoDetections.length ? Math.max(0.55, confidence) : 0, "logo_detection"),
    textDetections: listFieldValue(result.textDetections, result.textDetections.length ? Math.max(0.55, confidence) : 0, "ocr"),
    brandSignals: listFieldValue(result.brandSignals, result.brandSignals.length ? Math.max(0.55, confidence) : 0, "logo_detection"),
    entityWarnings: listFieldValue(result.entityWarnings, result.entityWarnings.length ? 1 : 0, "entity_resolver")
  };
}
