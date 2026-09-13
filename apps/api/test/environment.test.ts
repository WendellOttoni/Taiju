import { describe, expect, test } from "bun:test";
import { loadEnvironment } from "../src/config/environment";

describe("loadEnvironment", () => {
  test("uses the default API port", () => {
    expect(loadEnvironment({})).toEqual({
      ADULT_CONTENT_EMAILS: [],
      PORT: 3_000,
    });
  });

  test("rejects an invalid API port", () => {
    expect(() => loadEnvironment({ PORT: "0" })).toThrow();
  });

  test("normalizes and validates adult-content account emails", () => {
    expect(
      loadEnvironment({
        ADULT_CONTENT_EMAILS: " Reader@Example.com,second@example.com ",
      }).ADULT_CONTENT_EMAILS,
    ).toEqual(["reader@example.com", "second@example.com"]);
    expect(() =>
      loadEnvironment({ ADULT_CONTENT_EMAILS: "not-an-email" }),
    ).toThrow();
  });
});
