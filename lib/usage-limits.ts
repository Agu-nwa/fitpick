import { DailyUsage } from "@/models/DailyUsage";
import { getPlanEntitlements, getUserPlan } from "@/lib/entitlements";

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function getDailyPickUsage(userId: string) {
  const dateKey = todayKey();
  const usage = await DailyUsage.findOne({ userId, dateKey }).lean();
  return {
    dateKey,
    outfitPickCount: usage?.outfitPickCount || 0
  };
}

export async function getRemainingDailyPicks(userId: string) {
  const [{ plan }, usage] = await Promise.all([getUserPlan(userId), getDailyPickUsage(userId)]);
  const entitlements = getPlanEntitlements(plan);
  const limit = entitlements.limits.dailyPicks;

  return {
    plan,
    usageToday: usage.outfitPickCount,
    limit,
    remainingDailyPicks: limit === null ? null : Math.max(0, limit - usage.outfitPickCount),
    unlimited: limit === null
  };
}

export async function canCreateOutfitPick(userId: string) {
  const remaining = await getRemainingDailyPicks(userId);
  return {
    allowed: remaining.unlimited || (remaining.remainingDailyPicks || 0) > 0,
    ...remaining
  };
}

export async function incrementDailyPickUsage(userId: string) {
  const dateKey = todayKey();
  return DailyUsage.findOneAndUpdate(
    { userId, dateKey },
    { $inc: { outfitPickCount: 1 } },
    { upsert: true, new: true }
  ).lean();
}
