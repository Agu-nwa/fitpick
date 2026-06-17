const neutralColors = new Set(["black", "white", "grey", "gray", "navy", "beige", "cream", "brown", "tan"]);
const earthColors = new Set(["brown", "tan", "olive", "khaki", "cream", "beige"]);
const coolColors = new Set(["blue", "navy", "green", "teal", "purple"]);
const warmColors = new Set(["red", "orange", "yellow", "pink", "maroon"]);

export function colorGroup(color = "") {
  const normalized = color.toLowerCase();
  if (neutralColors.has(normalized)) return "neutral";
  if (earthColors.has(normalized)) return "earth";
  if (coolColors.has(normalized)) return "cool";
  if (warmColors.has(normalized)) return "warm";
  if (normalized.includes("print") || normalized.includes("ankara") || normalized.includes("pattern")) return "pattern";
  return "other";
}

export function colorCompatibilityScore(items: Array<{ color?: string; pattern?: string }>) {
  const groups = items.map((item) => colorGroup(item.color || item.pattern || ""));
  const neutralCount = groups.filter((group) => group === "neutral" || group === "earth").length;
  const uniqueGroups = new Set(groups.filter((group) => group !== "other"));

  if (neutralCount >= Math.max(1, items.length - 1)) return 18;
  if (uniqueGroups.size <= 2) return 14;
  if (groups.includes("pattern") && neutralCount >= 1) return 13;
  return 8;
}

export function colorNote(items: Array<{ color?: string; pattern?: string }>) {
  const score = colorCompatibilityScore(items);
  if (score >= 18) return "Neutral-compatible colors keep the outfit easy to wear.";
  if (score >= 13) return "Colors are balanced for a wearable outfit.";
  return "Color mix may need a quick review before wearing.";
}
