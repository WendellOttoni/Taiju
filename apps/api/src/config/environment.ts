import { z } from "zod";

const environmentSchema = z.object({
  ADULT_CONTENT_EMAILS: z
    .string()
    .optional()
    .transform((value) =>
      value === undefined
        ? []
        : [
            ...new Set(
              value
                .split(",")
                .map((email) => email.trim().toLowerCase())
                .filter(Boolean),
            ),
          ],
    )
    .pipe(z.array(z.email())),
  AUTH_JWT_SECRET: z.string().min(32).optional(),
  DATABASE_URL: z.string().url().optional(),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
  SUWAYOMI_PUBLIC_URL: z.string().url().optional(),
  SUWAYOMI_URL: z.string().url().optional(),
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(
  values: Record<string, string | undefined>,
): Environment {
  return environmentSchema.parse(values);
}
