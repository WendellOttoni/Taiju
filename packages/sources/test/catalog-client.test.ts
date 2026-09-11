import { expect, test } from "bun:test";
import type { SourceCatalogError } from "../src";

import { SourceCatalogClient, SourceCatalogTimeoutError } from "../src";

test("downloads the catalog as bytes with the expected media type", async () => {
  let requestHeaders: Headers | undefined;
  const client = new SourceCatalogClient({
    baseUrl: "https://catalog.test/index.pb",
    fetch: async (_input, init) => {
      requestHeaders = new Headers(init?.headers);
      return new Response(new Uint8Array([0, 1, 2]));
    },
  });

  expect(await client.fetchCatalog()).toEqual(new Uint8Array([0, 1, 2]));
  expect(requestHeaders?.get("accept")).toBe("application/octet-stream");
});

test("translates non-success catalog responses", async () => {
  const client = new SourceCatalogClient({
    fetch: async () => new Response(null, { status: 503 }),
  });
  await expect(client.fetchCatalog()).rejects.toMatchObject({
    name: "SourceCatalogError",
    status: 503,
  } satisfies Partial<SourceCatalogError>);
});

test("translates catalog timeouts", async () => {
  const client = new SourceCatalogClient({
    timeoutMs: 1,
    fetch: async (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      }),
  });
  await expect(client.fetchCatalog()).rejects.toBeInstanceOf(
    SourceCatalogTimeoutError,
  );
});
