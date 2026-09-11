import { describe, expect, test } from "bun:test";
import type { AuthUser, AuthUserRepository } from "@taiju/database";

import { createApp } from "../src/app";
import { createAuthService } from "../src/auth";

function createRepository(): AuthUserRepository {
  const users = new Map<string, AuthUser>();
  const id = "a1e53f6e-0a6e-4d03-9f06-e4761ac50de5";
  return {
    async create(email, passwordHash) {
      const user = { email, id, passwordHash };
      users.set(email, user);
      return user;
    },
    async findByEmail(email) {
      return users.get(email);
    },
    async findById(userId) {
      return Array.from(users.values()).find((user) => user.id === userId);
    },
  };
}

describe("authentication", () => {
  const app = createApp({
    auth: createAuthService(
      createRepository(),
      "this-is-a-test-only-jwt-secret-with-32-characters",
    ),
  });

  test("registers and authenticates a user", async () => {
    const register = await app.request("http://localhost/api/auth/register", {
      body: JSON.stringify({
        email: "Reader@Example.com",
        password: "a-secure-password",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(register.status).toBe(201);
    const registered = (await register.json()) as {
      token: string;
      user: { email: string };
    };
    expect(registered.user.email).toBe("reader@example.com");

    const currentUser = await app.request("http://localhost/api/auth/me", {
      headers: { Authorization: `Bearer ${registered.token}` },
    });
    expect(currentUser.status).toBe(200);
    expect((await currentUser.json()).email).toBe("reader@example.com");
  });

  test("rejects invalid login credentials", async () => {
    const response = await app.request("http://localhost/api/auth/login", {
      body: JSON.stringify({
        email: "reader@example.com",
        password: "wrong-password",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(response.status).toBe(401);
  });
});
