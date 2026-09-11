import { z } from "zod";

export const authCredentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
});

export const authenticatedUserSchema = z.object({
  email: z.string().email(),
  id: z.string().uuid(),
});

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
