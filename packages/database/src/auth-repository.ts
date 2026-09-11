import { eq } from "drizzle-orm";

import type { TaijuDatabase } from "./client";
import { passwordCredentials, users } from "./schema";

export type AuthUser = {
  email: string;
  id: string;
  passwordHash: string;
};

export type AuthUserRepository = {
  create(email: string, passwordHash: string): Promise<AuthUser>;
  findByEmail(email: string): Promise<AuthUser | undefined>;
  findById(id: string): Promise<AuthUser | undefined>;
};

export function createAuthUserRepository(
  database: TaijuDatabase,
): AuthUserRepository {
  const selectUser = (where: ReturnType<typeof eq>) =>
    database
      .select({
        email: users.email,
        id: users.id,
        passwordHash: passwordCredentials.passwordHash,
      })
      .from(users)
      .innerJoin(passwordCredentials, eq(passwordCredentials.userId, users.id))
      .where(where)
      .limit(1);

  return {
    async create(email, passwordHash) {
      return database.transaction(async (transaction) => {
        const [user] = await transaction
          .insert(users)
          .values({ email })
          .returning({ email: users.email, id: users.id });
        if (user === undefined) throw new Error("Failed to create user.");
        const [credential] = await transaction
          .insert(passwordCredentials)
          .values({ passwordHash, userId: user.id })
          .returning({ passwordHash: passwordCredentials.passwordHash });
        if (credential === undefined)
          throw new Error("Failed to create password credential.");
        return { ...user, passwordHash: credential.passwordHash };
      });
    },
    async findByEmail(email) {
      const [user] = await selectUser(eq(users.email, email));
      return user;
    },
    async findById(id) {
      const [user] = await selectUser(eq(users.id, id));
      return user;
    },
  };
}
