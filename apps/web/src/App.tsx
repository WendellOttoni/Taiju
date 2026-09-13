import {
  type SourceChapter,
  type SourceMangaDetails,
  type SourceMangaGroup,
  type SourceMangaSummary,
  type SourceReaderChapter,
  type SourceSummary,
  sourceChapterListSchema,
  sourceGroupedSearchResponseSchema,
  sourceLibraryResponseSchema,
  sourceListResponseSchema,
  sourceMangaDetailsSchema,
  sourceReaderChapterSchema,
  sourceReadingHistoryResponseSchema,
  sourceSearchResponseSchema,
} from "@taiju/contracts";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnimePage } from "./AnimePage";
import {
  buildDiscoveryUrl,
  buildSearchUrl,
  parseDiscoveryResponse,
  parseSearchResponse,
} from "./discovery";
import { authenticatedHeaders, authTokenKey } from "./lib/auth";

const debounceMs = 350;
const readerPreferencesKey = "taiju:reader-preferences";
const sourcePreferenceKey = "taiju:source-preference";
const languagePreferenceKey = "taiju:language-preference";
const authChangedEvent = "taiju:auth-changed";

type ReaderPreferences = {
  imageFit: "contain" | "width";
  mode: "vertical" | "paged";
  readingDirection: "ltr" | "rtl";
  uiVisible: boolean;
};

const defaultReaderPreferences: ReaderPreferences = {
  imageFit: "contain",
  mode: "vertical",
  readingDirection: "ltr",
  uiVisible: true,
};

function loadReaderPreferences(): ReaderPreferences {
  try {
    const value = JSON.parse(
      localStorage.getItem(readerPreferencesKey) ?? "{}",
    ) as Partial<ReaderPreferences>;
    return {
      imageFit: value.imageFit === "width" ? "width" : "contain",
      mode: value.mode === "paged" ? "paged" : "vertical",
      readingDirection: value.readingDirection === "rtl" ? "rtl" : "ltr",
      uiVisible: value.uiVisible !== false,
    };
  } catch {
    return defaultReaderPreferences;
  }
}

export function App() {
  const readerMatch = window.location.pathname.match(
    /^\/reader\/([^/]+)\/([^/]+)$/,
  );
  if (readerMatch !== null) {
    const [, provider, id] = readerMatch;
    if (provider !== undefined && id !== undefined)
      return (
        <ReaderPage
          provider={decodeURIComponent(provider)}
          id={decodeURIComponent(id)}
        />
      );
  }
  if (window.location.pathname === "/library") return <LibraryPage />;
  if (window.location.pathname === "/adult") return <AdultPage />;
  if (
    window.location.pathname === "/anime" ||
    window.location.pathname.startsWith("/anime/")
  )
    return <AnimePage />;
  const match = window.location.pathname.match(/^\/manga\/([^/]+)\/([^/]+)$/);
  if (match === null) return <SearchPage />;
  const [, provider, id] = match;
  if (provider === undefined || id === undefined) return <SearchPage />;
  return (
    <DetailsPage
      provider={decodeURIComponent(provider)}
      id={decodeURIComponent(id)}
    />
  );
}

function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SourceMangaGroup[]>([]);
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [hasAdultAccess, setHasAdultAccess] = useState(false);
  const [sourceId, setSourceId] = useState(
    () => localStorage.getItem(sourcePreferenceKey) ?? "",
  );
  const [preferredLanguage, setPreferredLanguage] = useState<"pt-BR" | "en">(
    () =>
      localStorage.getItem(languagePreferenceKey) === "en" ? "en" : "pt-BR",
  );
  const [failedSourceIds, setFailedSourceIds] = useState<string[]>([]);
  const [popular, setPopular] = useState<SourceMangaGroup[]>([]);
  const [latest, setLatest] = useState<SourceMangaGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    const onAuthChanged = () => setAuthVersion((current) => current + 1);
    window.addEventListener(authChangedEvent, onAuthChanged);
    return () => window.removeEventListener(authChangedEvent, onAuthChanged);
  }, []);

  // Re-run when authentication changes so restricted sources are refreshed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: authVersion intentionally triggers this refresh.
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/sources", {
      headers: (() => {
        const token = localStorage.getItem(authTokenKey);
        return token ? { Authorization: `Bearer ${token}` } : undefined;
      })(),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("As fontes não estão disponíveis agora.");
        return sourceListResponseSchema.parse(await response.json());
      })
      .then((payload) => {
        setHasAdultAccess(
          payload.items.some((source) => isRestrictedSource(source)),
        );
        setSources(payload.items);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar as fontes.",
          );
      });
    return () => controller.abort();
  }, [authVersion]);

  useEffect(() => {
    localStorage.setItem(languagePreferenceKey, preferredLanguage);
    setSourceId((current) =>
      current !== "all" &&
      sources.length > 0 &&
      !sources.some(
        (source) =>
          source.id === current && source.language === preferredLanguage,
      )
        ? ""
        : current,
    );
  }, [preferredLanguage, sources]);

  useEffect(() => {
    if (sourceId === "") localStorage.removeItem(sourcePreferenceKey);
    else localStorage.setItem(sourcePreferenceKey, sourceId);
  }, [sourceId]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0 || sourceId === "") {
      setResults([]);
      setFailedSourceIds([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/manga/search?q=${encodeURIComponent(normalizedQuery)}&source=${encodeURIComponent(sourceId)}`,
          { headers: authenticatedHeaders(), signal: controller.signal },
        );
        if (!response.ok) throw new Error("A busca não está disponível agora.");
        const json = await response.json();
        if (sourceId === "all") {
          const payload = sourceGroupedSearchResponseSchema.parse(json);
          setResults(payload.items);
          setFailedSourceIds(payload.failedSourceIds);
        } else {
          const payload = sourceSearchResponseSchema.parse(json);
          setResults(
            payload.items.map((item) => ({
              coverUrl: item.coverUrl,
              description: item.description,
              items: [item],
              key: `${item.source.sourceId}:${item.source.externalId}`,
              tags: item.tags,
              title: item.title,
            })),
          );
          setFailedSourceIds(payload.failedSourceIds);
        }
      } catch (reason) {
        if (!controller.signal.aborted) {
          setResults([]);
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível buscar mangás.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, debounceMs);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, sourceId]);

  useEffect(() => {
    if (sources.length === 0) return;
    const controller = new AbortController();
    void Promise.all([
      loadDiscovery("popular", "safe", controller.signal),
      loadDiscovery("latest", "safe", controller.signal),
    ])
      .then(([popularResult, latestResult]) => {
        setPopular(popularResult.items);
        setLatest(latestResult.items);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPopular([]);
          setLatest([]);
        }
      });
    return () => controller.abort();
  }, [sources]);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-50">
      <section className="mx-auto max-w-6xl">
        <AuthPanel />
        <nav className="mb-6 flex gap-4 text-sm">
          <a className="text-zinc-300 underline" href="/anime">
            Animes
          </a>
        </nav>
        {hasAdultAccess && (
          <nav className="mb-6 flex gap-4 text-sm">
            <a className="text-rose-300 underline" href="/adult">
              Área +18
            </a>
            <a className="text-zinc-300 underline" href="/library">
              Minha biblioteca
            </a>
          </nav>
        )}
        <p className="text-sm font-medium tracking-[0.3em] text-amber-400 uppercase">
          Taiju
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Encontre seu próximo mangá
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-300">
          Busque mangás, manhwas e manhuas no catálogo disponível.
        </p>
        <label className="relative mt-8 block max-w-2xl">
          <span className="sr-only">Buscar mangás</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex.: Berserk"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-4 pr-4 pl-12 text-lg outline-none placeholder:text-zinc-500 focus:border-amber-400"
          />
        </label>
        <label className="mt-4 block max-w-2xl">
          <span className="mb-2 block text-sm text-zinc-400">
            Idioma preferido
          </span>
          <select
            value={preferredLanguage}
            onChange={(event) =>
              setPreferredLanguage(event.target.value === "en" ? "en" : "pt-BR")
            }
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-amber-400"
          >
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="mt-4 block max-w-2xl">
          <span className="mb-2 block text-sm text-zinc-400">Fonte</span>
          <select
            value={sourceId}
            onChange={(event) => setSourceId(event.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-amber-400"
          >
            <option value="">Selecione uma fonte</option>
            <option value="all">Todas as fontes disponíveis</option>
            {sources
              .filter((source) => source.language === preferredLanguage)
              .map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name} · {source.language}
                </option>
              ))}
          </select>
        </label>
        {isLoading && (
          <p className="mt-8 text-zinc-300" role="status">
            Buscando títulos…
          </p>
        )}
        {error && (
          <p className="mt-8 text-red-300" role="alert">
            {error}
          </p>
        )}
        {failedSourceIds.length > 0 && (
          <p className="mt-4 text-sm text-amber-300" role="status">
            Algumas fontes não responderam; os demais resultados continuam
            disponíveis.
          </p>
        )}
        {query.trim() === "" && (
          <>
            <DiscoveryShelf
              items={popular}
              sources={sources}
              title="Mais acessados"
            />
            <DiscoveryShelf
              items={latest}
              sources={sources}
              title="Atualizações recentes"
            />
          </>
        )}
        {!isLoading &&
          !error &&
          query.trim() !== "" &&
          sourceId !== "" &&
          results.length === 0 && (
            <p className="mt-8 text-zinc-300">Nenhum título encontrado.</p>
          )}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {results.map((manga) => (
            <article
              key={manga.key}
              className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
            >
              <div className="aspect-[2/3] bg-zinc-800">
                {manga.coverUrl ? (
                  <img
                    src={manga.coverUrl}
                    alt={`Capa de ${manga.title}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </div>
              <div className="p-4">
                <h2 className="font-semibold">{manga.title}</h2>
                {manga.tags.length > 0 && (
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-400">
                    {manga.tags.join(" · ")}
                  </p>
                )}
                <p className="mt-3 text-xs text-zinc-400">
                  {manga.items.length === 1
                    ? "Fonte disponÃ­vel"
                    : `${manga.items.length} fontes disponÃ­veis`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {manga.items.map((item) => {
                    const source = sources.find(
                      (candidate) => candidate.id === item.source.sourceId,
                    );
                    return (
                      <a
                        key={`${item.source.sourceId}:${item.source.externalId}`}
                        href={`/manga/${encodeURIComponent(item.source.sourceId)}/${encodeURIComponent(item.source.externalId)}`}
                        className="rounded border border-zinc-700 px-2 py-1 text-xs hover:border-amber-400 hover:text-amber-300"
                      >
                        {source?.name ?? "Abrir fonte"}
                      </a>
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function DiscoveryShelf({
  items,
  sources,
  title,
}: {
  items: SourceMangaGroup[];
  sources: SourceSummary[];
  title: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold">{title}</h2>
      <div className="mt-4 flex gap-4 overflow-x-auto pb-3">
        {items.slice(0, 12).map((manga) => (
          <article
            className="w-36 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
            key={manga.key}
          >
            <div className="aspect-[2/3] bg-zinc-800">
              {manga.coverUrl && (
                <img
                  alt={`Capa de ${manga.title}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  src={manga.coverUrl}
                />
              )}
            </div>
            <div className="p-3">
              <h3 className="line-clamp-2 text-sm font-semibold">{manga.title}</h3>
              <div className="mt-2 flex flex-wrap gap-1">
                {manga.items.map((item) => {
                  const source = sources.find(
                    (candidate) => candidate.id === item.source.sourceId,
                  );
                  return (
                    <a
                      className="rounded border border-zinc-700 px-1.5 py-1 text-[10px] hover:border-amber-400"
                      href={`/manga/${encodeURIComponent(item.source.sourceId)}/${encodeURIComponent(item.source.externalId)}`}
                      key={`${item.source.sourceId}:${item.source.externalId}`}
                    >
                      {source?.name ?? "Fonte"}
                    </a>
                  );
                })}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdultPage() {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SourceMangaGroup[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [items, setItems] = useState<SourceMangaGroup[]>([]);
  const [pageRequest, setPageRequest] = useState({ page: 1, retry: 0 });
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (!localStorage.getItem(authTokenKey)) {
      setError("Esta área não está disponível para esta sessão.");
      return () => controller.abort();
    }
    void fetch("/api/sources", {
      headers: authenticatedHeaders(),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível validar o acesso.");
        const payload = sourceListResponseSchema.parse(await response.json());
        const restrictedSources = payload.items.filter(isRestrictedSource);
        if (restrictedSources.length === 0)
          throw new Error("Esta área não está disponível para esta conta.");
        setSources(restrictedSources);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "A área +18 não está disponível agora.",
          );
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (sources.length === 0) return;
    const controller = new AbortController();
    setIsLoadingPage(true);
    setError(null);
    void loadDiscovery(
      "latest",
      "adult",
      controller.signal,
      pageRequest.page,
      selectedSourceId,
    )
      .then((payload) => {
        setItems((current) => {
          const byKey = new Map(current.map((item) => [item.key, item]));
          for (const item of payload.items)
            if (!byKey.has(item.key)) byKey.set(item.key, item);
          return [...byKey.values()];
        });
        setHasNextPage(payload.hasNextPage);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setHasNextPage(false);
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar mais títulos.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingPage(false);
      });
    return () => controller.abort();
  }, [pageRequest, selectedSourceId, sources]);

  function selectSource(sourceId: string) {
    if (sourceId === selectedSourceId) return;
    setSelectedSourceId(sourceId);
    setItems([]);
    setPageRequest({ page: 1, retry: 0 });
    setHasNextPage(true);
    setIsLoadingPage(true);
    setError(null);
  }

  useEffect(() => {
    const normalizedQuery = searchQuery.trim();
    if (sources.length === 0 || normalizedQuery.length === 0) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const response = await fetch(
          buildSearchUrl({ query: normalizedQuery, sourceId: selectedSourceId }),
          { headers: authenticatedHeaders(), signal: controller.signal },
        );
        if (!response.ok)
          throw new Error("A pesquisa +18 não está disponível agora.");
        setSearchResults(
          parseSearchResponse(await response.json(), selectedSourceId).items,
        );
      } catch (reason) {
        if (!controller.signal.aborted) {
          setSearchResults([]);
          setSearchError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível pesquisar nesta área.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, debounceMs);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [searchQuery, selectedSourceId, sources.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (
      sentinel === null ||
      isLoadingPage ||
      !hasNextPage ||
      error !== null
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setIsLoadingPage(true);
        setPageRequest((current) => ({ page: current.page + 1, retry: 0 }));
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [error, hasNextPage, isLoadingPage]);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-50">
      <section className="mx-auto max-w-6xl">
        <nav className="flex gap-4 text-sm">
          <a className="text-amber-400" href="/">
            ← Voltar ao Taiju
          </a>
          <a className="text-zinc-300 underline" href="/library">
            Minha biblioteca
          </a>
        </nav>
        <p className="mt-10 text-sm font-medium tracking-[0.3em] text-rose-400 uppercase">
          Área restrita
        </p>
        <h1 className="mt-3 text-4xl font-bold">Conteúdo +18</h1>
        {error && sources.length === 0 ? (
          <p className="mt-8 text-red-300" role="alert">
            {error}
          </p>
        ) : sources.length === 0 ? (
          <p className="mt-8 text-zinc-300" role="status">
            Carregando fontes autorizadas…
          </p>
        ) : (
          <>
            <section className="mt-8">
              <h2 className="text-xl font-bold">Fontes disponíveis</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  aria-pressed={selectedSourceId === "all"}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    selectedSourceId === "all"
                      ? "border-rose-400 bg-rose-800 text-white"
                      : "border-rose-900 bg-rose-950/50 text-rose-200 hover:border-rose-500"
                  }`}
                  onClick={() => selectSource("all")}
                  type="button"
                >
                  Todas
                </button>
                {sources.map((source) => (
                  <button
                    aria-pressed={selectedSourceId === source.id}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      selectedSourceId === source.id
                        ? "border-rose-400 bg-rose-800 text-white"
                        : "border-rose-900 bg-rose-950/50 text-rose-200 hover:border-rose-500"
                    }`}
                    key={source.id}
                    onClick={() => selectSource(source.id)}
                    type="button"
                  >
                    {source.name}
                  </button>
                ))}
              </div>
            </section>
            <form
              className="mt-8 flex flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                setSearchQuery(searchInput.trim());
              }}
            >
              <label className="sr-only" htmlFor="adult-search">
                Pesquisar conteúdo +18
              </label>
              <input
                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-50 outline-none focus:border-rose-400"
                id="adult-search"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Pesquisar na área +18"
                value={searchInput}
              />
              <button
                className="rounded-lg bg-rose-800 px-5 py-3 font-semibold text-white hover:bg-rose-700"
                type="submit"
              >
                Pesquisar
              </button>
            </form>
            {searchQuery && (
              <p className="mt-3 text-sm text-zinc-400">
                Resultados para: <span className="text-rose-200">{searchQuery}</span>
              </p>
            )}
            <section className="mt-12">
              <h2 className="text-2xl font-bold">
                {searchQuery ? "Resultados da pesquisa" : "Conteúdo disponível"}
              </h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {(searchQuery ? searchResults : items).map((manga) => (
                  <article
                    className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
                    key={manga.key}
                  >
                    <div className="aspect-[2/3] bg-zinc-800">
                      {manga.coverUrl && (
                        <img
                          alt={`Capa de ${manga.title}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          src={manga.coverUrl}
                        />
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold">{manga.title}</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {manga.items.map((item) => {
                          const source = sources.find(
                            (candidate) =>
                              candidate.id === item.source.sourceId,
                          );
                          return (
                            <a
                              className="rounded border border-rose-900 px-2 py-1 text-xs text-rose-200 hover:border-rose-400"
                              href={`/manga/${encodeURIComponent(item.source.sourceId)}/${encodeURIComponent(item.source.externalId)}`}
                              key={`${item.source.sourceId}:${item.source.externalId}`}
                            >
                              {source?.name ?? "Abrir fonte"}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {!searchQuery && (
                <div ref={sentinelRef} className="h-1" aria-hidden="true" />
              )}
              {isSearching && (
                <p className="py-8 text-center text-zinc-300" role="status">
                  Pesquisando…
                </p>
              )}
              {searchError && (
                <p className="py-8 text-center text-red-300" role="alert">
                  {searchError}
                </p>
              )}
              {!searchQuery && isLoadingPage && (
                <p className="py-8 text-center text-zinc-300" role="status">
                  Carregando mais títulos…
                </p>
              )}
              {!searchQuery && error && sources.length > 0 && (
                <div className="py-8 text-center">
                  <p className="text-red-300" role="alert">
                    {error}
                  </p>
                  <button
                    className="mt-3 rounded border border-rose-700 px-3 py-2 text-sm text-rose-200"
                    onClick={() => {
                      setError(null);
                      setIsLoadingPage(true);
                      setPageRequest((current) => ({
                        ...current,
                        retry: current.retry + 1,
                      }));
                    }}
                    type="button"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}
              {!searchQuery && !isLoadingPage && !error && !hasNextPage && items.length > 0 && (
                <p className="py-8 text-center text-sm text-zinc-500">
                  Você chegou ao fim da lista.
                </p>
              )}
              {searchQuery && !isSearching && !searchError && searchResults.length === 0 && (
                <p className="py-8 text-zinc-400">
                  Nenhum título encontrado para esta pesquisa.
                </p>
              )}
              {!searchQuery && !isLoadingPage && !error && items.length === 0 && (
                <p className="py-8 text-zinc-400">
                  Nenhum título foi encontrado nas fontes disponíveis.
                </p>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

async function loadDiscovery(
  kind: "latest" | "popular",
  content: "adult" | "safe",
  signal: AbortSignal,
  page = 1,
  sourceId = "all",
) {
  const response = await fetch(
    buildDiscoveryUrl({ content, kind, page, sourceId }),
    { headers: authenticatedHeaders(), signal },
  );
  if (!response.ok) throw new Error("As vitrines não estão disponíveis agora.");
  return parseDiscoveryResponse(await response.json(), sourceId);
}

function isRestrictedSource(source: SourceSummary) {
  return source.contentRating === "adult";
}

function AuthPanel() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authenticated, setAuthenticated] = useState(
    () => localStorage.getItem(authTokenKey) !== null,
  );

  if (authenticated)
    return (
      <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm">
        <span className="text-emerald-200">Sessão ativa</span>
        <div className="flex gap-4">
          <a className="text-emerald-300 underline" href="/library">
            Minha biblioteca
          </a>
          <button
            className="text-emerald-300 underline"
            onClick={() => {
              localStorage.removeItem(authTokenKey);
              setAuthenticated(false);
              window.dispatchEvent(new Event(authChangedEvent));
            }}
            type="button"
          >
            Sair
          </button>
        </div>
      </div>
    );

  return (
    <form
      className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (isSubmitting) return;
        setMessage(null);
        setIsSubmitting(true);
        try {
          const response = await fetch(`/api/auth/${mode}`, {
            body: JSON.stringify({ email, password }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
          const payload = (await response.json()) as {
            token?: string;
            error?: {
              message?: string;
              details?: Array<{ field: string; message: string }>;
            };
          };
          if (!response.ok || !payload.token)
            throw new Error(
              payload.error?.message ?? "Não foi possível autenticar.",
            );
          localStorage.setItem(authTokenKey, payload.token);
          setAuthenticated(true);
          setPassword("");
          window.dispatchEvent(new Event(authChangedEvent));
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Não foi possível autenticar.",
          );
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <input
          autoComplete="email"
          aria-label="E-mail"
          className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-base outline-none focus:border-amber-400"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        <input
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          aria-label="Senha"
          className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-base outline-none focus:border-amber-400"
          minLength={12}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        <button
          className="min-h-11 rounded-lg bg-amber-400 px-4 py-2 font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Aguarde..." : mode === "login" ? "Entrar" : "Cadastrar"}
        </button>
      </div>
      {mode === "register" && (
        <p className="mt-2 text-xs text-zinc-400">
          A senha precisa ter entre 12 e 128 caracteres.
        </p>
      )}
      <div className="mt-3">
        <button
          className="text-sm text-zinc-400 underline"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          type="button"
        >
          {mode === "login" ? "Criar conta" : "Já tenho conta"}
        </button>
      </div>
      {message && (
        <p className="mt-2 text-sm text-red-300" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}

function LibraryPage() {
  const [favorites, setFavorites] = useState<
    Array<{ manga: { externalId: string; sourceId: string } }>
  >([]);
  const [history, setHistory] = useState<
    Array<{
      chapter: { externalId: string; sourceId: string };
      manga: { externalId: string; sourceId: string };
      page: number;
    }>
  >([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [removingHistoryKey, setRemovingHistoryKey] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!localStorage.getItem(authTokenKey)) {
      setError("Entre em sua conta para ver a biblioteca.");
      return;
    }
    const controller = new AbortController();
    void Promise.all([
      fetch("/api/source-library", {
        headers: authenticatedHeaders(),
        signal: controller.signal,
      }),
      fetch("/api/source-reading-history", {
        headers: authenticatedHeaders(),
        signal: controller.signal,
      }),
    ])
      .then(async ([libraryResponse, historyResponse]) => {
        if (!libraryResponse.ok || !historyResponse.ok)
          throw new Error("Não foi possível carregar sua biblioteca.");
        const library = sourceLibraryResponseSchema.parse(
          await libraryResponse.json(),
        );
        const savedHistory = sourceReadingHistoryResponseSchema.parse(
          await historyResponse.json(),
        );
        setFavorites(library.items);
        setHistory(savedHistory.items);
        const references = [
          ...library.items.map((item) => item.manga),
          ...savedHistory.items.map((item) => item.manga),
        ];
        const uniqueReferences = Array.from(
          new Map(
            references.map((reference) => [
              `${reference.sourceId}:${reference.externalId}`,
              reference,
            ]),
          ).values(),
        );
        const resolvedTitles = await Promise.allSettled(
          uniqueReferences.map(async (reference) => {
            const response = await fetch(
              `/api/manga/${encodeURIComponent(reference.sourceId)}/${encodeURIComponent(reference.externalId)}`,
              { headers: authenticatedHeaders(), signal: controller.signal },
            );
            if (!response.ok) return undefined;
            const manga = sourceMangaDetailsSchema.parse(await response.json());
            return {
              coverUrl: manga.coverUrl,
              key: `${reference.sourceId}:${reference.externalId}`,
              title: manga.title,
            };
          }),
        );
        setTitles(
          Object.fromEntries(
            resolvedTitles.flatMap((result) =>
              result.status === "fulfilled" && result.value !== undefined
                ? [[result.value.key, result.value.title]]
                : [],
            ),
          ),
        );
        setCovers(
          Object.fromEntries(
            resolvedTitles.flatMap((result) =>
              result.status === "fulfilled" &&
              result.value !== undefined &&
              result.value.coverUrl !== undefined
                ? [[result.value.key, result.value.coverUrl]]
                : [],
            ),
          ),
        );
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar sua biblioteca.",
          );
      });
    return () => controller.abort();
  }, []);

  async function removeHistoryEntry(item: (typeof history)[number]) {
    const key = `${item.manga.sourceId}:${item.manga.externalId}`;
    setRemovingHistoryKey(key);
    try {
      const response = await fetch(
        `/api/source-reading-history/${encodeURIComponent(item.manga.sourceId)}/${encodeURIComponent(item.manga.externalId)}`,
        { headers: authenticatedHeaders(), method: "DELETE" },
      );
      if (!response.ok) throw new Error("Não foi possível remover o histórico.");
      setHistory((current) =>
        current.filter(
          (entry) =>
            entry.manga.sourceId !== item.manga.sourceId ||
            entry.manga.externalId !== item.manga.externalId,
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível remover o histórico.",
      );
    } finally {
      setRemovingHistoryKey(null);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-50">
      <section className="mx-auto max-w-4xl">
        <a href="/" className="text-sm text-amber-400">
          ← Voltar à busca
        </a>
        <h1 className="mt-5 text-4xl font-bold">Minha biblioteca</h1>
        {error && <p className="mt-6 text-red-300" role="alert">{error}</p>}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Continuar lendo</h2>
          <div className="mt-4 grid gap-3">
            {history.length === 0 ? (
              <p className="text-zinc-400">Ainda não há leitura sincronizada.</p>
            ) : (
              history.map((item) => (
                <div
                  className="flex items-center rounded-xl border border-zinc-800 bg-zinc-900 p-4"
                  key={`${item.manga.sourceId}:${item.manga.externalId}`}
                >
                  <a
                    className="flex min-w-0 flex-1 items-center hover:text-amber-300"
                    href={`/reader/${encodeURIComponent(item.chapter.sourceId)}/${encodeURIComponent(item.chapter.externalId)}?manga=${encodeURIComponent(item.manga.externalId)}&page=${item.page}`}
                  >
                    {covers[`${item.manga.sourceId}:${item.manga.externalId}`] && (
                      <img
                        alt=""
                        className="mr-4 h-24 w-16 shrink-0 rounded object-cover"
                        src={covers[`${item.manga.sourceId}:${item.manga.externalId}`]}
                      />
                    )}
                    <div>
                      <p className="font-medium">
                        {titles[`${item.manga.sourceId}:${item.manga.externalId}`] ??
                          item.manga.externalId}
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">
                        Página {item.page}
                      </p>
                    </div>
                  </a>
                  <button
                    className="ml-3 shrink-0 rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-400 hover:text-red-300 disabled:opacity-50"
                    disabled={removingHistoryKey === `${item.manga.sourceId}:${item.manga.externalId}`}
                    onClick={() => void removeHistoryEntry(item)}
                    type="button"
                  >
                    {removingHistoryKey === `${item.manga.sourceId}:${item.manga.externalId}`
                      ? "Removendo…"
                      : "Remover"}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Favoritos</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {favorites.length === 0 ? (
              <p className="text-zinc-400">Nenhum favorito salvo ainda.</p>
            ) : (
              favorites.map((item) => (
                <a
                  className="flex items-center rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-amber-400"
                  href={`/manga/${encodeURIComponent(item.manga.sourceId)}/${encodeURIComponent(item.manga.externalId)}`}
                  key={`${item.manga.sourceId}:${item.manga.externalId}`}
                >
                  {covers[`${item.manga.sourceId}:${item.manga.externalId}`] && (
                    <img
                      alt=""
                      className="mr-4 h-24 w-16 shrink-0 rounded object-cover"
                      src={covers[`${item.manga.sourceId}:${item.manga.externalId}`]}
                    />
                  )}
                  <p className="font-medium">
                    {titles[`${item.manga.sourceId}:${item.manga.externalId}`] ??
                      item.manga.externalId}
                  </p>
                  <p className="hidden">
                    {item.manga.sourceId}
                  </p>
                </a>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function DetailsPage({ provider, id }: { provider: string; id: string }) {
  const [manga, setManga] = useState<SourceMangaDetails | null>(null);
  const [chapters, setChapters] = useState<SourceChapter[]>([]);
  const [alternatives, setAlternatives] = useState<SourceMangaSummary[]>([]);
  const [loadAlternatives, setLoadAlternatives] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/manga/${encodeURIComponent(provider)}/${encodeURIComponent(id)}`,
          {
            headers: authenticatedHeaders(),
            signal: controller.signal,
          },
        );
        if (!response.ok)
          throw new Error("Não foi possível carregar os detalhes.");
        setManga(sourceMangaDetailsSchema.parse(await response.json()));
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar os detalhes.",
          );
      }
    })();
    return () => controller.abort();
  }, [id, provider]);
  useEffect(() => {
    if (!localStorage.getItem(authTokenKey)) return;
    void fetch("/api/source-library", { headers: authenticatedHeaders() })
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((payload) =>
        setIsFavorite(
          (payload.items as Array<{ manga: { externalId: string; sourceId: string } }>).some(
            (item) =>
              item.manga.sourceId === provider && item.manga.externalId === id,
          ),
        ),
      )
      .catch(() => undefined);
  }, [id, provider]);
  useEffect(() => {
    if (provider === "mangadex" || !loadAlternatives) return;
    const controller = new AbortController();
    void fetch(
      `/api/manga/${encodeURIComponent(provider)}/${encodeURIComponent(id)}/alternatives`,
      { headers: authenticatedHeaders(), signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) return { items: [] };
        return (await response.json()) as { items: SourceMangaSummary[] };
      })
      .then((payload) => setAlternatives(payload.items))
      .catch(() => {
        if (!controller.signal.aborted) setAlternatives([]);
      });
    return () => controller.abort();
  }, [id, loadAlternatives, provider]);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/manga/${encodeURIComponent(provider)}/${encodeURIComponent(id)}/chapters`,
          {
            headers: authenticatedHeaders(),
            signal: controller.signal,
          },
        );
        if (!response.ok)
          throw new Error("Não foi possível carregar os capítulos.");
        setChapters(sourceChapterListSchema.parse(await response.json()).items);
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar os capítulos.",
          );
      }
    })();
    return () => controller.abort();
  }, [id, provider]);
  if (error)
    return (
      <main className="min-h-screen bg-zinc-950 p-8 text-red-300" role="alert">
        <p>{error}</p>
        <button
          className="mt-4 rounded border border-red-300 px-3 py-2 text-sm"
          onClick={() => window.location.reload()}
          type="button"
        >
          Tentar novamente
        </button>
      </main>
    );
  if (manga === null)
    return (
      <main
        className="min-h-screen bg-zinc-950 p-8 text-zinc-300"
        role="status"
      >
        Carregando detalhes…
      </main>
    );
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-50">
      <section className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[16rem_1fr]">
        <div className="aspect-[2/3] overflow-hidden rounded-xl bg-zinc-800">
          {manga.coverUrl && (
            <img
              src={manga.coverUrl}
              alt={`Capa de ${manga.title}`}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div>
          <a href="/" className="text-sm text-amber-400">
            ← Voltar à busca
          </a>
          <h1 className="mt-5 text-4xl font-bold">{manga.title}</h1>
          {localStorage.getItem(authTokenKey) && (
            <button
              className="mt-4 rounded border border-amber-400 px-3 py-2 text-sm text-amber-300"
              onClick={() => {
                const method = isFavorite ? "DELETE" : "PUT";
                void fetch(
                  `/api/source-library/${encodeURIComponent(provider)}/${encodeURIComponent(id)}`,
                  { headers: authenticatedHeaders(), method },
                ).then((response) => {
                  if (response.ok) setIsFavorite(!isFavorite);
                });
              }}
              type="button"
            >
              {isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            </button>
          )}
          {manga.alternativeTitles.length > 0 && (
            <p className="mt-2 text-zinc-400">
              {manga.alternativeTitles.join(" · ")}
            </p>
          )}
          {manga.description && (
            <p className="mt-6 leading-7 text-zinc-300">{manga.description}</p>
          )}
          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            <Detail label="Autores" values={manga.authors} />
            <Detail label="Artistas" values={manga.artists} />
            <Detail label="Tags" values={manga.tags} />
          </dl>
          {provider !== "mangadex" && (
            <section className="mt-8">
              <h2 className="text-xl font-bold">Outras fontes</h2>
              {!loadAlternatives && (
                <button
                  className="mt-3 rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-amber-400"
                  onClick={() => setLoadAlternatives(true)}
                  type="button"
                >
                  Procurar este título em outras fontes
                </button>
              )}
              {loadAlternatives && alternatives.length === 0 && (
                <p className="mt-3 text-sm text-zinc-400">
                  Nenhuma outra fonte equivalente foi encontrada.
                </p>
              )}
              {alternatives.length > 0 && <div className="mt-3 flex flex-wrap gap-2">
                {alternatives.map((alternative) => (
                  <a
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-amber-400"
                    href={`/manga/${encodeURIComponent(alternative.source.sourceId)}/${encodeURIComponent(alternative.source.externalId)}`}
                    key={`${alternative.source.sourceId}:${alternative.source.externalId}`}
                  >
                    {alternative.title} · {alternative.source.sourceId}
                  </a>
                ))}
              </div>}
            </section>
          )}
          <section className="mt-10">
            <h2 className="text-2xl font-bold">Capítulos</h2>
            <div className="mt-4 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
              {chapters.length === 0 ? (
                <p className="p-4 text-zinc-400">Nenhum capítulo disponível.</p>
              ) : (
                chapters.map((chapter) => (
                  <a
                    key={`${chapter.source.sourceId}:${chapter.source.externalId}`}
                    href={`/reader/${encodeURIComponent(chapter.source.sourceId)}/${encodeURIComponent(chapter.source.externalId)}?manga=${encodeURIComponent(id)}`}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-zinc-800"
                  >
                    <div>
                      <p className="font-medium">
                        Cap. {chapter.chapter ?? "—"}
                        {chapter.title && ` — ${chapter.title}`}
                      </p>
                      {chapter.scanlationGroup && (
                        <p className="mt-1 text-sm text-zinc-400">
                          {chapter.scanlationGroup}
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-zinc-500">
                      {chapter.language?.toUpperCase() ?? "—"}
                    </span>
                  </a>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Detail({ label, values }: { label: string; values: string[] }) {
  return values.length === 0 ? null : (
    <div>
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="mt-1 text-zinc-200">{values.join(" · ")}</dd>
    </div>
  );
}

function ReaderPage({ provider, id }: { provider: string; id: string }) {
  const [chapter, setChapter] = useState<SourceReaderChapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedPages, setFailedPages] = useState<Set<number>>(() => new Set());
  const [siblings, setSiblings] = useState<SourceChapter[]>([]);
  const [preferences, setPreferences] = useState<ReaderPreferences>(
    loadReaderPreferences,
  );
  const [pageIndex, setPageIndex] = useState(0);
  const [lastReadPage, setLastReadPage] = useState<number | null>(null);
  const resumedPositionKey = useRef<string | null>(null);
  const mangaId = new URLSearchParams(window.location.search).get("manga");
  const resumePage = Number(new URLSearchParams(window.location.search).get("page"));
  const { imageFit, mode, readingDirection, uiVisible } = preferences;

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setChapter(null);
        setPageIndex(Number.isInteger(resumePage) && resumePage > 0 ? resumePage - 1 : 0);
        setFailedPages(new Set());
        const response = await fetch(
          `/api/chapters/${encodeURIComponent(provider)}/${encodeURIComponent(id)}/pages`,
          {
            headers: authenticatedHeaders(),
            signal: controller.signal,
          },
        );
        if (!response.ok)
          throw new Error("Não foi possível preparar o leitor.");
        setChapter(sourceReaderChapterSchema.parse(await response.json()));
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível preparar o leitor.",
          );
      }
    })();
    return () => controller.abort();
  }, [id, provider, resumePage]);

  useEffect(() => {
    if (mangaId === null) return;
    const controller = new AbortController();
    void fetch(
      `/api/manga/${encodeURIComponent(provider)}/${encodeURIComponent(mangaId)}/chapters`,
      {
        headers: authenticatedHeaders(),
        signal: controller.signal,
      },
    )
      .then((response) => (response.ok ? response.json() : undefined))
      .then((data) => {
        if (data !== undefined)
          setSiblings(sourceChapterListSchema.parse(data).items);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [mangaId, provider]);

  const currentIndex = siblings.findIndex(
    (item) =>
      item.source.externalId === id && item.source.sourceId === provider,
  );
  const previous = currentIndex > 0 ? siblings[currentIndex - 1] : undefined;
  const next = currentIndex >= 0 ? siblings[currentIndex + 1] : undefined;

  useEffect(() => {
    if (chapter === null || mode !== "paged") return;

    for (const neighbor of [pageIndex - 1, pageIndex + 1]) {
      const pageUrl = chapter.pageUrls[neighbor];
      if (pageUrl !== undefined) new Image().src = pageUrl;
    }
  }, [chapter, mode, pageIndex]);

  useEffect(() => {
    if (chapter === null || mode !== "vertical") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        const page = Number(visible?.target.getAttribute("data-reader-page"));
        if (Number.isInteger(page) && page > 0) setLastReadPage(page);
      },
      { threshold: [0.6] },
    );
    document
      .querySelectorAll<HTMLElement>("[data-reader-page]")
      .forEach((element) => {
        observer.observe(element);
      });
    return () => observer.disconnect();
  }, [chapter, mode]);

  useEffect(() => {
    if (
      chapter === null ||
      mode !== "vertical" ||
      !Number.isInteger(resumePage) ||
      resumePage < 2
    )
      return;
    const key = `${id}:${resumePage}`;
    if (resumedPositionKey.current === key) return;
    resumedPositionKey.current = key;
    window.requestAnimationFrame(() => {
      document
        .getElementById(`reader-page-${resumePage}`)
        ?.scrollIntoView({ block: "start" });
    });
  }, [chapter, id, mode, resumePage]);

  useEffect(() => {
    if (chapter === null || mode !== "paged") return;

    const onKeyDown = (event: KeyboardEvent) => {
      const movesForward =
        (event.key === "ArrowRight" && readingDirection === "ltr") ||
        (event.key === "ArrowLeft" && readingDirection === "rtl");
      const movesBackward =
        (event.key === "ArrowLeft" && readingDirection === "ltr") ||
        (event.key === "ArrowRight" && readingDirection === "rtl");
      if (movesBackward) setPageIndex((current) => Math.max(0, current - 1));
      if (movesForward)
        setPageIndex((current) =>
          Math.min(chapter.pageUrls.length - 1, current + 1),
        );
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chapter, mode, readingDirection]);

  useEffect(() => {
    localStorage.setItem(readerPreferencesKey, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    if (
      lastReadPage === null ||
      mangaId === null ||
      !localStorage.getItem(authTokenKey)
    )
      return;
    const timeout = window.setTimeout(() => {
      void fetch("/api/source-reading-progress", {
        body: JSON.stringify({
          chapter: { externalId: id, sourceId: provider },
          manga: { externalId: mangaId, sourceId: provider },
          page: lastReadPage,
        }),
        headers: {
          ...authenticatedHeaders(),
          "Content-Type": "application/json",
        },
        method: "PUT",
      });
    }, 750);
    return () => window.clearTimeout(timeout);
  }, [id, lastReadPage, mangaId, provider]);

  if (error)
    return (
      <main className="min-h-screen bg-zinc-950 p-8 text-red-300">{error}</main>
    );
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      {uiVisible && (
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/95 px-6 py-4 backdrop-blur">
          <a href="/" className="text-amber-400">
            ← Voltar
          </a>
          <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
            <ReaderPreferenceButton
              active={mode === "vertical"}
              onClick={() =>
                setPreferences((current) => ({ ...current, mode: "vertical" }))
              }
            >
              Vertical
            </ReaderPreferenceButton>
            <ReaderPreferenceButton
              active={mode === "paged"}
              onClick={() =>
                setPreferences((current) => ({ ...current, mode: "paged" }))
              }
            >
              Paginado
            </ReaderPreferenceButton>
            <ReaderPreferenceButton
              active={readingDirection === "rtl"}
              onClick={() =>
                setPreferences((current) => ({
                  ...current,
                  readingDirection:
                    current.readingDirection === "ltr" ? "rtl" : "ltr",
                }))
              }
            >
              {readingDirection === "ltr" ? "LTR" : "RTL"}
            </ReaderPreferenceButton>
            <ReaderPreferenceButton
              active={imageFit === "width"}
              onClick={() =>
                setPreferences((current) => ({
                  ...current,
                  imageFit:
                    current.imageFit === "contain" ? "width" : "contain",
                }))
              }
            >
              {imageFit === "contain" ? "Ajustar" : "Largura"}
            </ReaderPreferenceButton>
            <button
              type="button"
              className="rounded bg-zinc-800 px-3 py-1 text-zinc-300"
              onClick={() =>
                setPreferences((current) => ({ ...current, uiVisible: false }))
              }
            >
              Ocultar UI
            </button>
          </div>
        </header>
      )}
      {!uiVisible && (
        <button
          type="button"
          className="fixed right-4 top-4 z-20 rounded bg-zinc-800 px-3 py-2 text-sm"
          onClick={() =>
            setPreferences((current) => ({ ...current, uiVisible: true }))
          }
        >
          Mostrar UI
        </button>
      )}
      {chapter === null ? (
        <p className="p-8 text-zinc-300" role="status">
          Preparando páginas…
        </p>
      ) : (
        <section className="mx-auto max-w-5xl">
          {mode === "vertical" ? (
            chapter.pageUrls.map((pageUrl, index) =>
              failedPages.has(index) ? (
                <div
                  key={pageUrl}
                  className="grid aspect-[2/3] place-items-center bg-zinc-900 text-zinc-400"
                >
                  Falha ao carregar a página {index + 1}.
                </div>
              ) : (
                <img
                  data-reader-page={index + 1}
                  id={`reader-page-${index + 1}`}
                  key={pageUrl}
                  src={pageUrl}
                  alt={`Página ${index + 1}`}
                  loading="lazy"
                  className={
                    imageFit === "width"
                      ? "block w-full"
                      : "mx-auto block max-w-full"
                  }
                  onError={() =>
                    setFailedPages((current) => new Set(current).add(index))
                  }
                />
              ),
            )
          ) : (
            <PagedPage
              pageUrl={chapter.pageUrls[pageIndex] ?? ""}
              pageIndex={pageIndex}
              pageCount={chapter.pageUrls.length}
              failed={failedPages.has(pageIndex)}
              onLoad={() =>
                {
                  localStorage.setItem(
                    `taiju:reader:${id}`,
                    String(pageIndex + 1),
                  );
                  setLastReadPage(pageIndex + 1);
                }
              }
              onError={() =>
                setFailedPages((current) => new Set(current).add(pageIndex))
              }
              onPrevious={() =>
                setPageIndex((current) => Math.max(0, current - 1))
              }
              onNext={() =>
                setPageIndex((current) =>
                  Math.min(chapter.pageUrls.length - 1, current + 1),
                )
              }
              imageFit={imageFit}
            />
          )}
          <nav className="flex justify-between gap-4 p-6">
            {previous ? (
              <a
                href={`/reader/${encodeURIComponent(previous.source.sourceId)}/${encodeURIComponent(previous.source.externalId)}?manga=${encodeURIComponent(mangaId ?? "")}`}
                className="rounded bg-zinc-800 px-4 py-2"
              >
                ← Capítulo anterior
              </a>
            ) : (
              <span />
            )}
            {next ? (
              <a
                href={`/reader/${encodeURIComponent(next.source.sourceId)}/${encodeURIComponent(next.source.externalId)}?manga=${encodeURIComponent(mangaId ?? "")}`}
                className="rounded bg-zinc-800 px-4 py-2"
              >
                Próximo capítulo →
              </a>
            ) : (
              <span />
            )}
          </nav>
        </section>
      )}
    </main>
  );
}

function ReaderPreferenceButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`rounded px-3 py-1 ${active ? "bg-amber-400 text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PagedPage({
  pageUrl,
  pageIndex,
  pageCount,
  failed,
  onLoad,
  onError,
  onPrevious,
  onNext,
  imageFit,
}: {
  pageUrl: string;
  pageIndex: number;
  pageCount: number;
  failed: boolean;
  onLoad: () => void;
  onError: () => void;
  onPrevious: () => void;
  onNext: () => void;
  imageFit: ReaderPreferences["imageFit"];
}) {
  return (
    <div className="min-h-[calc(100vh-73px)] bg-zinc-900 p-4">
      <p className="mb-3 text-center text-sm text-zinc-400">
        Página {pageIndex + 1} de {pageCount} · use ← e → para navegar
      </p>
      {failed ? (
        <div className="mx-auto grid max-w-3xl aspect-[2/3] place-items-center bg-zinc-800 text-zinc-400">
          Falha ao carregar a página {pageIndex + 1}.
        </div>
      ) : (
        <img
          key={pageUrl}
          src={pageUrl}
          alt={`Página ${pageIndex + 1}`}
          className={
            imageFit === "width"
              ? "mx-auto w-full"
              : "mx-auto max-h-[calc(100vh-150px)] max-w-full object-contain"
          }
          onLoad={onLoad}
          onError={onError}
        />
      )}
      <div className="mx-auto mt-4 flex max-w-3xl justify-between gap-4">
        <button
          type="button"
          className="rounded bg-zinc-800 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pageIndex === 0}
          onClick={onPrevious}
        >
          ← Página anterior
        </button>
        <button
          type="button"
          className="rounded bg-zinc-800 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pageIndex === pageCount - 1}
          onClick={onNext}
        >
          Próxima página →
        </button>
      </div>
    </div>
  );
}
