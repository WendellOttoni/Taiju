import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/schema/index.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/taiju",
  },
});
