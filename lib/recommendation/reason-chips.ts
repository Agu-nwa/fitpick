export const safeReasonChips = [
  "Occasion-ready",
  "Color-balanced",
  "Weather-aware",
  "Not worn recently",
  "Comfort-first",
  "Polished finish",
  "Event-aware"
] as const;

export type ReasonChip = (typeof safeReasonChips)[number];

export function buildReasonChips(input: {
  occasionReady: boolean;
  colorBalanced: boolean;
  weatherAware: boolean;
  fresh: boolean;
  comfort: boolean;
  polished: boolean;
  eventAware: boolean;
}) {
  const chips: ReasonChip[] = [];
  if (input.occasionReady) chips.push("Occasion-ready");
  if (input.colorBalanced) chips.push("Color-balanced");
  if (input.weatherAware) chips.push("Weather-aware");
  if (input.fresh) chips.push("Not worn recently");
  if (input.comfort) chips.push("Comfort-first");
  if (input.polished) chips.push("Polished finish");
  if (input.eventAware) chips.push("Event-aware");
  return chips.length ? chips : ["Occasion-ready"];
}
