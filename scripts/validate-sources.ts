const apiBase = (process.env.TAIJU_API_URL ?? "http://localhost:3000").replace(
  /\/$/,
);
const query = process.argv.slice(2).join(" ").trim() || "solo leveling";

type Source = { id: string; name: string };
type ValidationResult = {
  capability: string;
  status: string;
  message?: string;
};
type ValidationReport = {
  sourceId: string;
  passed: boolean;
  results: ValidationResult[];
};

const sourceResponse = await fetch(
  `${apiBase}/api/sources?language=pt-BR`,
);
if (!sourceResponse.ok) {
  throw new Error(`Could not list sources: HTTP ${sourceResponse.status}`);
}
const sourcePayload = (await sourceResponse.json()) as {
  items?: Source[];
};
const sources = Array.isArray(sourcePayload.items) ? sourcePayload.items : [];

console.log(`Testing ${sources.length} sources with query: ${query}`);
console.log("source | search | details | chapters | pages | thumbnail");

for (const source of sources) {
  const validationUrl = new URL(`${apiBase}/api/sources/validate`);
  validationUrl.searchParams.set("q", query);
  validationUrl.searchParams.set("source", source.id);
  const validationResponse = await fetch(validationUrl);
  const validationPayload = (await validationResponse.json()) as {
    items?: ValidationReport[];
    error?: { message?: string };
  };
  const report = validationPayload.items?.[0];
  const statuses = new Map(
    report?.results.map((result) => [result.capability, result]) ?? [],
  );

  let thumbnail = "skipped";
  try {
    const searchUrl = new URL(`${apiBase}/api/manga/search`);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("source", source.id);
    const searchResponse = await fetch(searchUrl);
    const searchPayload = (await searchResponse.json()) as {
      items?: Array<{ coverUrl?: string }>;
    };
    const coverUrl = searchPayload.items?.find(
      (item) => typeof item.coverUrl === "string" && item.coverUrl.length > 0,
    )?.coverUrl;
    if (coverUrl === undefined) thumbnail = "no-cover";
    else {
      const coverResponse = await fetch(coverUrl, {
        signal: AbortSignal.timeout(15_000),
      });
      const contentType = coverResponse.headers.get("content-type") ?? "";
      thumbnail =
        coverResponse.ok && contentType.startsWith("image/")
          ? "passed"
          : `failed(${coverResponse.status})`;
      await coverResponse.body?.cancel();
    }
  } catch (error) {
    thumbnail = `failed(${error instanceof Error ? error.message : "error"})`;
  }

  const status = (capability: string) =>
    statuses.get(capability)?.status ??
    (report === undefined ? "failed" : "missing");
  console.log(
    `${source.name} | ${status("search")} | ${status("details")} | ${status("chapters")} | ${status("pages")} | ${thumbnail}`,
  );
}
