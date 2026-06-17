import { PlusSubscription } from "@/models/PlusSubscription";

export type FeatureKey =
  | "outfit_picks_daily"
  | "unlimited_outfit_picks"
  | "advanced_swaps"
  | "advanced_outfit_memory"
  | "event_planning"
  | "travel_packing"
  | "priority_tagging"
  | "style_learning";

export function getPlanEntitlements(plan: "free" | "plus") {
  const plus = plan === "plus";

  return {
    plan,
    limits: {
      dailyPicks: plus ? null : 3,
      wardrobeItems: plus ? null : 50,
      savedLooks: plus ? null : 25
    },
    features: {
      outfit_picks_daily: true,
      unlimited_outfit_picks: plus,
      advanced_swaps: plus,
      advanced_outfit_memory: plus,
      event_planning: plus,
      travel_packing: plus,
      priority_tagging: plus,
      style_learning: plus,
      basic_wardrobe: true,
      basic_recommendations: true,
      standard_tag_review: true
    }
  };
}

export async function getUserPlan(userId: string) {
  const subscription = await PlusSubscription.findOne({ userId }).lean();
  const activePlus = subscription?.plan === "plus" && ["active", "trialing"].includes(subscription.status);
  return {
    plan: activePlus ? "plus" : "free",
    subscription
  } as const;
}

export async function canUseFeature(userId: string, featureKey: FeatureKey) {
  const { plan } = await getUserPlan(userId);
  const entitlements = getPlanEntitlements(plan);
  return Boolean(entitlements.features[featureKey]);
}

export async function requirePlusForFeature(userId: string, featureKey: FeatureKey) {
  const allowed = await canUseFeature(userId, featureKey);
  return { allowed, featureKey, upgradePath: "/plus" };
}
