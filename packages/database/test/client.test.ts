import { expect, test } from "bun:test";

import { parseDatabaseUrl } from "../src/client";

test("accepts PostgreSQL connection URLs", () => {
  expect(
    parseDatabaseUrl("postgresql://taiju:secret@localhost:5432/taiju"),
  ).toBe("postgresql://taiju:secret@localhost:5432/taiju");
});

test("rejects non-PostgreSQL connection URLs", () => {
  expect(() => parseDatabaseUrl("https://example.com/database")).toThrow(
    "DATABASE_URL must use the postgres or postgresql protocol.",
  );
});
