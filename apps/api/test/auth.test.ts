import { describe, expect, test } from "bun:test";
import type {
  AuthUser,
  AuthUserRepository,
  HistoryRepository,
  LibraryRepository,
} from "@taiju/database";

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
    sourcePreferences: {
      async get() {
        return undefined;
      },
      async save(_userId, preferences) {
        return { ...preferences, updatedAt: new Date("2026-01-01T00:00:00Z") };
      },
    },
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

  test("explains invalid authentication fields", async () => {
    const response = await app.request("http://localhost/api/auth/register", {
      body: JSON.stringify({ email: "not-an-email", password: "short" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: "validation_error",
        message: expect.stringContaining("e-mail válido"),
        details: [
          { field: "email" },
          { field: "password" },
        ],
      },
    });
  });

  test("rejects malformed JSON with a validation error", async () => {
    const response = await app.request("http://localhost/api/auth/register", {
      body: "{",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "validation_error", message: "Envie um corpo JSON válido." },
    });
  });

  test("saves and reads authenticated source preferences", async () => {
    const register = await app.request("http://localhost/api/auth/register", {
      body: JSON.stringify({
        email: "prefs@example.com",
        password: "a-secure-password",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const token = (await register.json()).token as string;
    const saved = await app.request("http://localhost/api/source-preferences", {
      body: JSON.stringify({
        preferredLanguages: ["en"],
        enabledSourceIds: ["source:1"],
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "PUT",
    });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({
      preferredLanguages: ["en"],
      enabledSourceIds: ["source:1"],
    });
    const loaded = await app.request(
      "http://localhost/api/source-preferences",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    expect(loaded.status).toBe(200);
    expect(await loaded.json()).toEqual({
      preferredLanguages: ["pt-BR", "en"],
      enabledSourceIds: [],
    });
  });

  test("rejects invalid source preference payloads", async () => {
    const register = await app.request("http://localhost/api/auth/register", {
      body: JSON.stringify({
        email: "invalid-prefs@example.com",
        password: "a-secure-password",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const token = (await register.json()).token as string;
    const response = await app.request(
      "http://localhost/api/source-preferences",
      {
        body: JSON.stringify({ preferredLanguages: [], enabledSourceIds: [] }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PUT",
      },
    );
    expect(response.status).toBe(400);
  });

  test("persists source-neutral favorites and reading progress", async () => {
    const libraryItems: Array<{
      createdAt: Date;
      mangaProvider: string;
      mangaProviderId: string;
    }> = [];
    const historyItems: Array<{
      chapterProvider: string;
      chapterProviderId: string;
      mangaProvider: string;
      mangaProviderId: string;
      page: string;
      updatedAt: Date;
    }> = [];
    const library: LibraryRepository = {
      async add(_userId, mangaProvider, mangaProviderId) {
        libraryItems.push({
          createdAt: new Date("2026-01-01T00:00:00Z"),
          mangaProvider,
          mangaProviderId,
        });
      },
      async list() {
        return libraryItems;
      },
      async remove(_userId, mangaProvider, mangaProviderId) {
        const index = libraryItems.findIndex(
          (item) =>
            item.mangaProvider === mangaProvider &&
            item.mangaProviderId === mangaProviderId,
        );
        if (index >= 0) libraryItems.splice(index, 1);
      },
    };
    const history: HistoryRepository = {
      async list() {
        return historyItems;
      },
      async remove(_userId, mangaProvider, mangaProviderId) {
        const index = historyItems.findIndex(
          (item) =>
            item.mangaProvider === mangaProvider &&
            item.mangaProviderId === mangaProviderId,
        );
        if (index >= 0) historyItems.splice(index, 1);
      },
      async save(_userId, entry) {
        historyItems.splice(0, historyItems.length, {
          ...entry,
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        });
      },
    };
    const testApp = createApp({
      auth: createAuthService(
        createRepository(),
        "this-is-a-test-only-jwt-secret-with-32-characters",
      ),
      history,
      library,
    });
    const register = await testApp.request("http://localhost/api/auth/register", {
      body: JSON.stringify({
        email: "source-state@example.com",
        password: "a-secure-password",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const token = (await register.json()).token as string;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    expect(
      (
        await testApp.request(
          "http://localhost/api/source-library/example.source%3A1/manga-123",
          { headers, method: "PUT" },
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await testApp.request("http://localhost/api/source-reading-progress", {
          body: JSON.stringify({
            chapter: { externalId: "chapter-9", sourceId: "example.source:1" },
            manga: { externalId: "manga-123", sourceId: "example.source:1" },
            page: 7,
          }),
          headers,
          method: "PUT",
        })
      ).status,
    ).toBe(204);
    const favorites = await testApp.request("http://localhost/api/source-library", {
      headers,
    });
    const favoritesPayload = await favorites.json();
    expect(favoritesPayload).toMatchObject({
      items: [
        {
          manga: { externalId: "manga-123", sourceId: "example.source:1" },
        },
      ],
    });
    const savedHistory = await testApp.request(
      "http://localhost/api/source-reading-history",
      { headers },
    );
    expect(await savedHistory.json()).toMatchObject({
      items: [
        {
          chapter: { externalId: "chapter-9", sourceId: "example.source:1" },
          manga: { externalId: "manga-123", sourceId: "example.source:1" },
          page: 7,
        },
      ],
    });
    expect(
      (
        await testApp.request(
          "http://localhost/api/source-reading-history/example.source%3A1/manga-123",
          { headers, method: "DELETE" },
        )
      ).status,
    ).toBe(204);
    expect(
      (await (await testApp.request("http://localhost/api/source-reading-history", { headers })).json()).items,
    ).toEqual([]);
    const remainingFavorites = await testApp.request(
      "http://localhost/api/source-library",
      { headers },
    );
    expect((await remainingFavorites.json()).items).toHaveLength(1);
  });
});
