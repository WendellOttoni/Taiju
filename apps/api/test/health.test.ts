import { describe, expect, test } from "bun:test";
import { app } from "../src/app";

describe("GET /health", () => {
  test("returns the service health response", async () => {
    const response = await app.request("http://localhost/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      service: "taiju-api",
    });
  });
});
