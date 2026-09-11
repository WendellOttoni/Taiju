import { z } from "zod";

export const sourceLanguageSchema = z
  .string()
  .regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/, "Invalid source language code.");

export const sourceCapabilitySchema = z.enum([
  "chapters",
  "details",
  "pages",
  "search",
]);

export const sourceProvenanceSchema = z.object({
  catalogUrl: z.string().url(),
  packageName: z.string().trim().min(1),
  sourceUrl: z.string().url().optional(),
});

export const sourceSummarySchema = z.object({
  capabilities: z.array(sourceCapabilitySchema).min(1),
  compatible: z.boolean(),
  id: z.string().trim().min(1),
  language: sourceLanguageSchema,
  name: z.string().trim().min(1),
  provenance: sourceProvenanceSchema,
  version: z.string().trim().min(1),
});

export const sourceRefSchema = z.object({
  externalId: z.string().trim().min(1),
  sourceId: z.string().trim().min(1),
});

export const sourceListResponseSchema = z.object({
  items: z.array(sourceSummarySchema),
});

export type SourceCapability = z.infer<typeof sourceCapabilitySchema>;
export type SourceLanguage = z.infer<typeof sourceLanguageSchema>;
export type SourceProvenance = z.infer<typeof sourceProvenanceSchema>;
export type SourceRef = z.infer<typeof sourceRefSchema>;
export type SourceSummary = z.infer<typeof sourceSummarySchema>;
