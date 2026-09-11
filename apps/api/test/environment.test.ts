import { describe, expect, test } from "bun:test";
import { loadEnvironment } from "../src/config/environment";

describe("loadEnvironment", () => {
  test("uses the default API port", () => {
    expect(loadEnvironment({})).toEqual({ PORT: 3_000 });
  });

  test("rejects an invalid API port", () => {
    expect(() => loadEnvironment({ PORT: "0" })).toThrow();
  });
});
