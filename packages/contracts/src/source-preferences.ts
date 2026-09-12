import { z } from "zod";

export const sourcePreferencesSchema = z.object({
  preferredLanguages: z.array(z.string().trim().min(2).max(20)).min(1).max(10),
  enabledSourceIds: z.array(z.string().trim().min(1).max(200)).max(500),
});

export type SourcePreferences = z.infer<typeof sourcePreferencesSchema>;
