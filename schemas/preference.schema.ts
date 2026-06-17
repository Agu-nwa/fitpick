import { z } from "zod";

export const stylePreferenceSchema = z.object({
  styleIdentity: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  formality: z.enum(["relaxed", "balanced", "polished", "formal"]).optional(),
  colorPreferences: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  avoidColors: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  comfortPriority: z.enum(["low", "medium", "high"]).optional(),
  nativeWearFrequency: z.enum(["rarely", "sometimes", "often", "weekly"]).optional(),
  repeatSensitivity: z.enum(["low", "medium", "high"]).optional(),
  weatherEnabled: z.boolean().optional(),
  photoStorageConsent: z.boolean().optional(),
  personalizedRecommendations: z.boolean().optional(),
  outfitHistoryEnabled: z.boolean().optional(),
  marketingNotifications: z.boolean().optional()
});
