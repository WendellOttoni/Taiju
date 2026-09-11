import {
  type SourceChapter,
  sourceChapterListSchema,
  type SourceMangaDetails,
  type SourceMangaSummary,
  sourceMangaDetailsSchema,
  sourceReaderChapterSchema,
  sourceSearchResponseSchema,
  sourceListResponseSchema,
  type SourceReaderChapter,
  type SourceSummary,
} from "@taiju/contracts";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

const debounceMs = 350;
const readerPreferencesKey = "taiju:reader-preferences";
const sourcePreferenceKey = "taiju:source-preference";

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
      return <ReaderPage provider={decodeURIComponent(provider)} id={decodeURIComponent(id)} />;
  }
  const match = window.location.pathname.match(
    /^\/manga\/([^/]+)\/([^/]+)$/,
  );
  if (match === null) return <SearchPage />;
  const [, provider, id] = match;
  if (provider === undefined || id === undefined) return <SearchPage />;
  return <DetailsPage provider={decodeURIComponent(provider)} id={decodeURIComponent(id)} />;
}

function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SourceMangaSummary[]>([]);
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [sourceId, setSourceId] = useState(
    () => localStorage.getItem(sourcePreferenceKey) ?? "",
  );
  const [failedSourceIds, setFailedSourceIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/sources?language=pt-BR&language=en", {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("As fontes não estão disponíveis agora.");
        return sourceListResponseSchema.parse(await response.json());
      })
      .then((payload) => setSources(payload.items))
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Não foi possível carregar as fontes.");
      });
    return () => controller.abort();
  }, []);

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
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("A busca não está disponível agora.");
        const payload = sourceSearchResponseSchema.parse(await response.json());
        setResults(payload.items);
        setFailedSourceIds(payload.failedSourceIds);
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

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-50">
      <section className="mx-auto max-w-6xl">
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
          <span className="mb-2 block text-sm text-zinc-400">Fonte</span>
          <select
            value={sourceId}
            onChange={(event) => setSourceId(event.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-amber-400"
          >
            <option value="">Selecione uma fonte</option>
            <option value="all">Todas as fontes disponíveis</option>
            {sources.map((source) => (
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
            Algumas fontes não responderam; os demais resultados continuam disponíveis.
          </p>
        )}
        {!isLoading &&
          !error &&
          query.trim() !== "" && sourceId !== "" &&
          results.length === 0 && (
            <p className="mt-8 text-zinc-300">Nenhum título encontrado.</p>
          )}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {results.map((manga) => (
            <a
              key={`${manga.source.sourceId}:${manga.source.externalId}`}
              href={`/manga/${encodeURIComponent(manga.source.sourceId)}/${encodeURIComponent(manga.source.externalId)}`}
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
              </div>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

function DetailsPage({ provider, id }: { provider: string; id: string }) {
  const [manga, setManga] = useState<SourceMangaDetails | null>(null);
  const [chapters, setChapters] = useState<SourceChapter[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/manga/${encodeURIComponent(provider)}/${encodeURIComponent(id)}`, {
          signal: controller.signal,
        });
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
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/manga/${encodeURIComponent(provider)}/${encodeURIComponent(id)}/chapters`, {
          signal: controller.signal,
        });
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
        {error}
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
  const mangaId = new URLSearchParams(window.location.search).get("manga");
  const { imageFit, mode, readingDirection, uiVisible } = preferences;

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setChapter(null);
        setPageIndex(0);
        setFailedPages(new Set());
        const response = await fetch(`/api/chapters/${encodeURIComponent(provider)}/${encodeURIComponent(id)}/pages`, {
          signal: controller.signal,
        });
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
  }, [id, provider]);

  useEffect(() => {
    if (mangaId === null) return;
    const controller = new AbortController();
    void fetch(`/api/manga/${encodeURIComponent(provider)}/${encodeURIComponent(mangaId)}/chapters`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((data) => {
        if (data !== undefined)
          setSiblings(sourceChapterListSchema.parse(data).items);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [mangaId, provider]);

  const currentIndex = siblings.findIndex(
    (item) => item.source.externalId === id && item.source.sourceId === provider,
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
                  key={pageUrl}
                  src={pageUrl}
                  alt={`Página ${index + 1}`}
                  loading="lazy"
                  className={
                    imageFit === "width"
                      ? "block w-full"
                      : "mx-auto block max-w-full"
                  }
                  onLoad={() =>
                    localStorage.setItem(
                      `taiju:reader:${id}`,
                      String(index + 1),
                    )
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
                localStorage.setItem(
                  `taiju:reader:${id}`,
                  String(pageIndex + 1),
                )
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
