import { z } from "zod";

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  avatarUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  timezone: z.string().trim().min(1).max(80).optional().or(z.literal("")),
  locale: z.string().trim().min(2).max(20).optional().or(z.literal(""))
});

export const deleteRequestSchema = z.object({
  reason: z.string().trim().max(240).optional()
});
