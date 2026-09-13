import {
  type SourceGroupedSearchResponse,
  sourceGroupedSearchResponseSchema,
  sourceSearchResponseSchema,
} from "@taiju/contracts";

type DiscoveryRequest = {
  content: "adult" | "safe";
  kind: "latest" | "popular";
  page: number;
  sourceId: string;
};

type SearchRequest = {
  query: string;
  sourceId: string;
};

export function buildDiscoveryUrl(request: DiscoveryRequest) {
  const query = new URLSearchParams({
    kind: request.kind,
    page: String(request.page),
    source: request.sourceId,
  });
  if (request.sourceId === "all") query.set("content", request.content);
  return `/api/manga/discover?${query.toString()}`;
}

export function parseDiscoveryResponse(
  payload: unknown,
  sourceId: string,
): SourceGroupedSearchResponse {
  if (sourceId === "all")
    return sourceGroupedSearchResponseSchema.parse(payload);

  const parsed = sourceSearchResponseSchema.parse(payload);
  return {
    ...parsed,
    items: parsed.items.map((item) => ({
      coverUrl: item.coverUrl,
      description: item.description,
      items: [item],
      key: `${item.source.sourceId}:${item.source.externalId}`,
      tags: item.tags,
      title: item.title,
    })),
  };
}

export function buildSearchUrl(request: SearchRequest) {
  const query = new URLSearchParams({
    q: request.query,
    source: request.sourceId,
  });
  if (request.sourceId === "all") query.set("content", "adult");
  return `/api/manga/search?${query.toString()}`;
}

export function parseSearchResponse(
  payload: unknown,
  sourceId: string,
): SourceGroupedSearchResponse {
  if (sourceId === "all")
    return sourceGroupedSearchResponseSchema.parse(payload);

  const parsed = sourceSearchResponseSchema.parse(payload);
  return {
    ...parsed,
    items: parsed.items.map((item) => ({
      coverUrl: item.coverUrl,
      description: item.description,
      items: [item],
      key: `${item.source.sourceId}:${item.source.externalId}`,
      tags: item.tags,
      title: item.title,
    })),
  };
}
