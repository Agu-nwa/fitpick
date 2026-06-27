export type OccasionGroup =
  | "everyday"
  | "work"
  | "formal"
  | "social"
  | "cultural"
  | "weather"
  | "travel";

export function inferOccasionGroup(input: { name?: string; group?: string; weatherContext?: string }) {
  const name = `${input.name || ""} ${input.group || ""} ${input.weatherContext || ""}`.toLowerCase();
  if (/(native|traditional|owambe|aso-ebi|aso ebi|cultural|agbada|kaftan|ankara|isiagu)/.test(name)) return "cultural";
  if (/(church|wedding)/.test(name)) return "formal";
  if (/(rain|hot|cold|weather|harmattan)/.test(name)) return "weather";
  if (/(travel|vacation|airport|beach|resort)/.test(name)) return "travel";
  if (/(work|office|meeting|business casual|business)/.test(name)) return "work";
  if (/(formal|interview|gala|black tie)/.test(name)) return "formal";
  if (/(date|date night|dinner|hangout|social|smart casual)/.test(name)) return "social";
  if (/(streetwear|weekend|casual)/.test(name)) return "everyday";
  return "everyday";
}

export function structureFor(group: OccasionGroup) {
  switch (group) {
    case "work":
      return ["tops", "bottoms", "shoes", "outerwear", "accessories"];
    case "formal":
      return ["dresses", "tops", "bottoms", "shoes", "outerwear", "accessories"];
    case "cultural":
      return ["native", "shoes", "accessories"];
    case "weather":
      return ["tops", "bottoms", "shoes", "outerwear"];
    case "travel":
      return ["tops", "bottoms", "shoes", "bags", "outerwear"];
    default:
      return ["tops", "bottoms", "shoes", "accessories"];
  }
}

export function missingCoreCategories(items: any[], desiredCategories: string[]) {
  const present = new Set(items.map((item) => item.category));
  return desiredCategories.filter((category) => !["outerwear", "accessories", "bags"].includes(category) && !present.has(category));
}
