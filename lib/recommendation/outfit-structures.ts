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
  if (name.includes("native") || name.includes("traditional") || name.includes("owambe") || name.includes("church")) return "cultural";
  if (name.includes("rain") || name.includes("hot") || name.includes("weather")) return "weather";
  if (name.includes("travel")) return "travel";
  if (name.includes("work") || name.includes("office") || name.includes("meeting")) return "work";
  if (name.includes("formal") || name.includes("wedding") || name.includes("interview")) return "formal";
  if (name.includes("date") || name.includes("hangout") || name.includes("social")) return "social";
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
