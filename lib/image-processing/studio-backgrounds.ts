export type StudioBackgroundPresetId =
  | "luxury_dark"
  | "ivory"
  | "soft_gradient"
  | "editorial_gray"
  | "transparent";

export type StudioBackgroundPreset = {
  id: StudioBackgroundPresetId;
  label: string;
  description: string;
  background: {
    type: "solid" | "gradient" | "transparent";
    value: string;
  };
  recommendedCategories: string[];
};

export const studioBackgroundPresets: Record<StudioBackgroundPresetId, StudioBackgroundPreset> = {
  luxury_dark: {
    id: "luxury_dark",
    label: "Luxury dark",
    description: "Deep editorial backdrop for premium garments, bags, shoes, and eveningwear.",
    background: { type: "solid", value: "#171310" },
    recommendedCategories: ["bags", "shoes", "outerwear", "dresses", "accessories"]
  },
  ivory: {
    id: "ivory",
    label: "Ivory studio",
    description: "Soft clean studio tone for wardrobe cards and everyday garments.",
    background: { type: "solid", value: "#f7f2ea" },
    recommendedCategories: ["tops", "bottoms", "dresses", "native", "outerwear"]
  },
  soft_gradient: {
    id: "soft_gradient",
    label: "Soft gradient",
    description: "Subtle FitPick editorial gradient for colorful garments.",
    background: { type: "gradient", value: "linear-gradient(180deg,#f7f2ea,#e8ddd0)" },
    recommendedCategories: ["tops", "dresses", "native", "outerwear"]
  },
  editorial_gray: {
    id: "editorial_gray",
    label: "Editorial gray",
    description: "Neutral gray background for sportswear and structured pieces.",
    background: { type: "solid", value: "#d8d6d1" },
    recommendedCategories: ["tops", "shoes", "outerwear", "accessories"]
  },
  transparent: {
    id: "transparent",
    label: "Transparent",
    description: "Transparent cutout-ready background for future compositing.",
    background: { type: "transparent", value: "transparent" },
    recommendedCategories: ["tops", "bottoms", "dresses", "native", "outerwear", "shoes", "bags", "accessories"]
  }
};

export function getStudioBackgroundPreset(value?: string | null) {
  const id = (value || process.env.FITPICK_STUDIO_BACKGROUND_PRESET || "ivory") as StudioBackgroundPresetId;
  return studioBackgroundPresets[id] || studioBackgroundPresets.ivory;
}
