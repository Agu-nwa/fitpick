import { z } from "zod";

export const notificationPreferenceSchema = z.object({
  morningReminder: z.boolean().optional(),
  weatherAlerts: z.boolean().optional(),
  eventPrep: z.boolean().optional(),
  repeatWarnings: z.boolean().optional(),
  quietHours: z
    .object({
      enabled: z.boolean().optional(),
      start: z.string().trim().max(10).optional(),
      end: z.string().trim().max(10).optional()
    })
    .optional(),
  timezone: z.string().trim().min(1).max(80).optional().or(z.literal("")),
  pushToken: z.string().trim().min(8).max(500).optional()
});
