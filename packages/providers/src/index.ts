export type {
  MangaDexClientOptions,
  MangaDexRequestOptions,
} from "./mangadex/client";
export { MangaDexClient } from "./mangadex/client";
export { getMangaDetails } from "./mangadex/details";
export type { MangaDexRateLimit } from "./mangadex/errors";
export {
  MangaDexHttpError,
  MangaDexRateLimitError,
  MangaDexTimeoutError,
} from "./mangadex/errors";
export { searchManga } from "./mangadex/search";
