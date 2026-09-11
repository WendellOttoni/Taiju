import { z } from "zod";

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(
  values: Record<string, string | undefined>,
): Environment {
  return environmentSchema.parse(values);
}
