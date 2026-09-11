import { expect, test } from "bun:test";

import { profiles, users } from "../src/schema";

test("defines Taiju-owned users and profiles", () => {
  expect(users.id.name).toBe("id");
  expect(users.email.name).toBe("email");
  expect(profiles.userId.name).toBe("user_id");
});
