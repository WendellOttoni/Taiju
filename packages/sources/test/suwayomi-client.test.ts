import { describe, expect, test } from "bun:test";
import {
  SuwayomiClientError,
  SuwayomiClientTimeoutError,
  SuwayomiRuntimeClient,
} from "../src";

describe("Suwayomi runtime client", () => {
  test("uses the isolated REST boundary", async () => {
    let requested = "";
    const client = new SuwayomiRuntimeClient({
      baseUrl: "http://suwayomi.test",
      fetch: async (input) => {
        requested = String(input);
        return Response.json({ sources: [] });
      },
    });
    await expect(client.listSources()).resolves.toEqual({ sources: [] });
    expect(requested).toBe("http://suwayomi.test/api/v1/source");
  });
  test("translates HTTP and timeout failures", async () => {
    const failing = new SuwayomiRuntimeClient({
      baseUrl: "http://suwayomi.test",
      fetch: async () => new Response("", { status: 503 }),
    });
    await expect(failing.listSources()).rejects.toBeInstanceOf(
      SuwayomiClientError,
    );
    const slow = new SuwayomiRuntimeClient({
      baseUrl: "http://suwayomi.test",
      timeoutMs: 5,
      fetch: async (_input, init) =>
        await new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          ),
        ),
    });
    await expect(slow.listSources()).rejects.toBeInstanceOf(
      SuwayomiClientTimeoutError,
    );
  });
});
