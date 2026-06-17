import { colorCompatibilityScore } from "@/lib/recommendation/color";

export function formalityScore(item: any, target?: string) {
  if (!target) return 8;
  return item.formality?.includes(target) ? 16 : 7;
}

export function occasionScore(item: any, occasionName = "") {
  const target = occasionName.toLowerCase();
  if (!target) return 8;
  return item.occasions?.some((occasion: string) => target.includes(occasion.toLowerCase()) || occasion.toLowerCase().includes(target))
    ? 18
    : 7;
}

export function weatherScore(item: any, weatherContext = "") {
  const target = weatherContext.toLowerCase();
  if (!target) return 8;
  return item.weather?.some((weather: string) => target.includes(weather.toLowerCase()) || weather.toLowerCase().includes(target)) ? 15 : 6;
}

export function freshnessScore(item: any, repeatDays: number) {
  if (!item.lastWornAt) return 14;
  const ageDays = (Date.now() - new Date(item.lastWornAt).getTime()) / 86_400_000;
  return ageDays >= repeatDays ? 14 : 3;
}

export function readinessScore(item: any, allowNeedsCare?: boolean) {
  if (item.condition === "ready") return 14;
  if (item.condition === "needs-care") return allowNeedsCare ? 4 : -50;
  return 1;
}

export function scoreOutfit(items: any[], input: { occasionName?: string; formality?: string; weatherContext?: string; repeatDays: number; allowNeedsCare?: boolean }) {
  const itemScore = items.reduce(
    (sum, item) =>
      sum +
      occasionScore(item, input.occasionName) +
      formalityScore(item, input.formality) +
      weatherScore(item, input.weatherContext) +
      freshnessScore(item, input.repeatDays) +
      readinessScore(item, input.allowNeedsCare),
    0
  );

  return itemScore + colorCompatibilityScore(items);
}
