export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { ContentRule } from "@/models/ContentRule";
import { Occasion } from "@/models/Occasion";

const globalOccasions = [
  { name: "Work", group: "everyday", formality: "polished" },
  { name: "School", group: "everyday", formality: "balanced" },
  { name: "Church", group: "cultural", formality: "polished" },
  { name: "Wedding Guest", group: "social", formality: "formal" },
  { name: "Owambe", group: "cultural", formality: "formal" },
  { name: "Traditional Event", group: "cultural", formality: "formal" },
  { name: "Interview", group: "formal", formality: "formal" },
  { name: "Date/Social Outing", group: "social", formality: "balanced" },
  { name: "Travel", group: "everyday", formality: "balanced" },
  { name: "Native Friday", group: "cultural", formality: "balanced" },
  { name: "Business Meeting", group: "formal", formality: "polished" },
  { name: "Casual Hangout", group: "social", formality: "relaxed" },
  { name: "Rainy Day", group: "weather", formality: "balanced" },
  { name: "Hot Day", group: "weather", formality: "relaxed" }
] as const;

const reasonChips = [
  "Occasion-ready",
  "Color-balanced",
  "Weather-aware",
  "Not worn recently",
  "Comfort-first",
  "Polished finish",
  "Event-aware"
];

const contentRules = [
  {
    type: "wardrobe_category",
    entries: [
      ["tops", "Tops"],
      ["bottoms", "Bottoms"],
      ["dresses", "Dresses"],
      ["native", "Native/traditional"],
      ["outerwear", "Outerwear"],
      ["shoes", "Shoes"],
      ["bags", "Bags"],
      ["accessories", "Accessories"],
      ["care_missing_item", "Care/missing item"]
    ]
  },
  {
    type: "category_subtype",
    entries: [
      ["shirt", "Shirt"],
      ["t_shirt", "T-shirt"],
      ["blouse", "Blouse"],
      ["jeans", "Jeans"],
      ["trousers", "Trousers"],
      ["skirt", "Skirt"],
      ["gown", "Gown"],
      ["ankara", "Ankara"],
      ["senator", "Senator wear"],
      ["kaftan", "Kaftan"],
      ["agbada", "Agbada"],
      ["lace", "Lace"],
      ["sneakers", "Sneakers"],
      ["sandals", "Sandals"],
      ["watch", "Watch"]
    ]
  },
  {
    type: "style_tag",
    entries: [
      ["minimal", "Minimal"],
      ["classic", "Classic"],
      ["streetwear", "Streetwear"],
      ["native_polished", "Native polished"],
      ["smart_casual", "Smart casual"],
      ["bold_color", "Bold color"],
      ["soft_neutral", "Soft neutral"]
    ]
  },
  {
    type: "formality_tag",
    entries: [
      ["relaxed", "Relaxed"],
      ["balanced", "Balanced"],
      ["polished", "Polished"],
      ["formal", "Formal"]
    ]
  },
  {
    type: "weather_tag",
    entries: [
      ["hot_day", "Hot day"],
      ["rainy_day", "Rainy day"],
      ["harmattan", "Harmattan"],
      ["evening", "Evening"],
      ["travel", "Travel"]
    ]
  },
  {
    type: "condition_tag",
    entries: [
      ["ready", "ready"],
      ["needs_care", "needs-care"],
      ["missing_tags", "missing-tags"]
    ]
  },
  {
    type: "occasion_tag",
    entries: [
      ["work", "Work"],
      ["school", "School"],
      ["church", "Church"],
      ["wedding", "Wedding"],
      ["owambe", "Owambe"],
      ["traditional_event", "Traditional event"],
      ["interview", "Interview"],
      ["date_social_outing", "Date/social outing"],
      ["casual_hangout", "Casual hangout"],
      ["travel", "Travel"],
      ["rainy_day", "Rainy day"],
      ["hot_day", "Hot day"],
      ["native_friday", "Native Friday"],
      ["business_meeting", "Business meeting"]
    ]
  }
] as const;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    if (auth.user.role !== "admin") return apiError("FORBIDDEN", "Admin access is required.");

    await connectDB();

    for (const occasion of globalOccasions) {
      await Occasion.updateOne(
        { name: occasion.name, isGlobal: true },
        { $setOnInsert: { ...occasion, isGlobal: true } },
        { upsert: true }
      );
    }

    for (const chip of reasonChips) {
      await ContentRule.updateOne(
        { type: "reason_chip", key: chip.toLowerCase().replaceAll(" ", "_").replaceAll("-", "_") },
        { $set: { label: chip, active: true } },
        { upsert: true }
      );
    }

    let contentRuleCount = reasonChips.length;

    for (const group of contentRules) {
      for (const [key, label] of group.entries) {
        await ContentRule.updateOne(
          { type: group.type, key },
          { $set: { label, active: true, metadata: { source: "phase-5b-seed" } } },
          { upsert: true }
        );
        contentRuleCount += 1;
      }
    }

    await recordAuditEvent({ request, userId: String(auth.user._id), action: "admin.seed", entityType: "ContentRule" });

    return apiSuccess(
      { occasions: globalOccasions.length, reasonChips: reasonChips.length, contentRules: contentRuleCount },
      { message: "Seed skeleton completed." }
    );
  } catch (error) {
    console.error("FitPick seed error:", error);
    return apiError("INTERNAL_ERROR", "Unable to run seed skeleton right now.");
  }
}
