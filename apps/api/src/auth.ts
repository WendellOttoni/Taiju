import type { AuthenticatedUser } from "@taiju/contracts";
import type { AuthUserRepository } from "@taiju/database";
import { sign, verify } from "hono/jwt";

type JwtPayload = {
  email: string;
  exp: number;
  sub: string;
};

export class AuthenticationError extends Error {}
export class EmailAlreadyRegisteredError extends Error {}

export type AuthService = {
  authenticate(token: string): Promise<AuthenticatedUser>;
  login(
    email: string,
    password: string,
  ): Promise<{ token: string; user: AuthenticatedUser }>;
  register(
    email: string,
    password: string,
  ): Promise<{ token: string; user: AuthenticatedUser }>;
};

export function createAuthService(
  repository: AuthUserRepository,
  jwtSecret: string,
): AuthService {
  const issueToken = (user: AuthenticatedUser) =>
    sign(
      {
        email: user.email,
        exp: Math.floor(Date.now() / 1_000) + 60 * 60 * 24 * 7,
        sub: user.id,
      },
      jwtSecret,
    );
  const response = async (user: AuthenticatedUser) => ({
    token: await issueToken(user),
    user,
  });

  return {
    async authenticate(token) {
      let payload: JwtPayload;
      try {
        payload = (await verify(token, jwtSecret, "HS256")) as JwtPayload;
      } catch {
        throw new AuthenticationError("Invalid authentication token.");
      }
      const user = await repository.findById(payload.sub);
      if (user === undefined)
        throw new AuthenticationError("Invalid authentication token.");
      return { email: user.email, id: user.id };
    },
    async login(email, password) {
      const user = await repository.findByEmail(email);
      if (
        user === undefined ||
        !(await Bun.password.verify(password, user.passwordHash))
      )
        throw new AuthenticationError("Invalid email or password.");
      return response({ email: user.email, id: user.id });
    },
    async register(email, password) {
      if ((await repository.findByEmail(email)) !== undefined)
        throw new EmailAlreadyRegisteredError("Email is already registered.");
      const passwordHash = await Bun.password.hash(password, "argon2id");
      try {
        const user = await repository.create(email, passwordHash);
        return response({ email: user.email, id: user.id });
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "23505")
          throw new EmailAlreadyRegisteredError("Email is already registered.");
        throw error;
      }
    },
  };
}

export function bearerToken(value: string | undefined): string | undefined {
  if (value === undefined || !value.startsWith("Bearer ")) return undefined;
  const token = value.slice("Bearer ".length).trim();
  return token.length === 0 ? undefined : token;
}
