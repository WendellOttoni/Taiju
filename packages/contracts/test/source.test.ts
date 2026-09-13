import { expect, test } from "bun:test";

import { sourceLanguageSchema, sourceSummarySchema } from "../src/source";

test("accepts prioritized Portuguese and English source languages", () => {
  expect(sourceLanguageSchema.parse("pt-BR")).toBe("pt-BR");
  expect(sourceLanguageSchema.parse("en")).toBe("en");
});

test("validates source identity, provenance and capabilities", () => {
  const source = sourceSummarySchema.parse({
    capabilities: ["search", "details", "chapters", "pages"],
    compatible: true,
    contentRating: "adult",
    id: "example-source",
    language: "pt-BR",
    name: "Example Source",
    packageName: "ignored",
    provenance: {
      catalogUrl: "https://catalog.example/index.pb",
      packageName: "com.example.source",
    },
    version: "1.0.0",
  });
  expect(source.provenance.packageName).toBe("com.example.source");
  expect(source.contentRating).toBe("adult");
});
