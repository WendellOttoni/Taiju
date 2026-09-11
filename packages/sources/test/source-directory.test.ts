import { expect, test } from "bun:test";

import { SuwayomiRuntimeClient, SuwayomiSourceDirectory } from "../src";

test("lists only runtime-loaded sources with normalized language metadata", async () => {
  const directory = new SuwayomiSourceDirectory(
    new SuwayomiRuntimeClient({
      baseUrl: "http://suwayomi.test",
      fetch: async () =>
        Response.json({
          data: {
            sources: {
              nodes: [
                {
                  id: "0",
                  lang: "localsourcelang",
                  name: "Local source",
                  extension: { pkgName: "local.source", versionName: "1.0" },
                },
                {
                  id: "7",
                  lang: "pt_br",
                  name: "Fonte",
                  extension: { pkgName: "example.source", versionName: "1.2" },
                },
              ],
            },
          },
        }),
    }),
  );

  await expect(directory.list(["pt-BR"])).resolves.toMatchObject([
    {
      compatible: true,
      id: "example.source:7",
      language: "pt-BR",
      name: "Fonte",
    },
  ]);
});
