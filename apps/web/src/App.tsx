import {
  type ChapterSummary,
  chapterFeedResponseSchema,
  type MangaDetails,
  type MangaSummary,
  mangaDetailsSchema,
  mangaSearchResponseSchema,
  type ReaderChapter,
  readerChapterSchema,
} from "@taiju/contracts";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

const debounceMs = 350;

export function App() {
  const readerMatch = window.location.pathname.match(
    /^\/reader\/(mangadex)\/([0-9a-f-]{36})$/i,
  );
  if (readerMatch !== null) {
    const [, provider, id] = readerMatch;
    if (provider !== undefined && id !== undefined)
      return <ReaderPage provider={provider} id={id} />;
  }
  const match = window.location.pathname.match(
    /^\/manga\/(mangadex)\/([0-9a-f-]{36})$/i,
  );
  if (match === null) return <SearchPage />;
  const [, provider, id] = match;
  if (provider === undefined || id === undefined) return <SearchPage />;
  return <DetailsPage provider={provider} id={id} />;
}

function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MangaSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0) {
      setResults([]);
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
          `/api/manga/search?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("A busca não está disponível agora.");
        const payload = mangaSearchResponseSchema.parse(await response.json());
        setResults(payload.items);
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
  }, [query]);

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
        {!isLoading &&
          !error &&
          query.trim() !== "" &&
          results.length === 0 && (
            <p className="mt-8 text-zinc-300">Nenhum título encontrado.</p>
          )}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {results.map((manga) => (
            <a
              key={`${manga.provider}:${manga.providerId}`}
              href={`/manga/${manga.provider}/${manga.providerId}`}
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
  const [manga, setManga] = useState<MangaDetails | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/manga/${provider}/${id}`, {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error("Não foi possível carregar os detalhes.");
        setManga(mangaDetailsSchema.parse(await response.json()));
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
        const response = await fetch(`/api/manga/${provider}/${id}/chapters`, {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error("Não foi possível carregar os capítulos.");
        setChapters(
          chapterFeedResponseSchema.parse(await response.json()).items,
        );
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
            <Detail label="Idiomas" values={manga.availableLanguages} />
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
                    key={`${chapter.provider}:${chapter.providerId}`}
                    href={`/reader/${chapter.provider}/${chapter.providerId}?manga=${id}`}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-zinc-800"
                  >
                    <div>
                      <p className="font-medium">
                        {chapter.volume && `Vol. ${chapter.volume} · `}Cap.{" "}
                        {chapter.chapter ?? "—"}
                        {chapter.title && ` — ${chapter.title}`}
                      </p>
                      {chapter.scanlationGroup && (
                        <p className="mt-1 text-sm text-zinc-400">
                          {chapter.scanlationGroup.name}
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-zinc-500">
                      {chapter.language.toUpperCase()}
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
  const [chapter, setChapter] = useState<ReaderChapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedPages, setFailedPages] = useState<Set<number>>(() => new Set());
  const [siblings, setSiblings] = useState<ChapterSummary[]>([]);
  const [mode, setMode] = useState<"vertical" | "paged">("vertical");
  const [pageIndex, setPageIndex] = useState(0);
  const mangaId = new URLSearchParams(window.location.search).get("manga");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setChapter(null);
        setPageIndex(0);
        setFailedPages(new Set());
        const response = await fetch(`/api/chapters/${provider}/${id}/pages`, {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error("Não foi possível preparar o leitor.");
        setChapter(readerChapterSchema.parse(await response.json()));
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
    void fetch(`/api/manga/${provider}/${mangaId}/chapters?limit=100`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((data) => {
        if (data !== undefined)
          setSiblings(chapterFeedResponseSchema.parse(data).items);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [mangaId, provider]);

  const currentIndex = siblings.findIndex((item) => item.providerId === id);
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
      if (event.key === "ArrowLeft")
        setPageIndex((current) => Math.max(0, current - 1));
      if (event.key === "ArrowRight")
        setPageIndex((current) =>
          Math.min(chapter.pageUrls.length - 1, current + 1),
        );
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chapter, mode]);

  if (error)
    return (
      <main className="min-h-screen bg-zinc-950 p-8 text-red-300">{error}</main>
    );
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-6 py-4 backdrop-blur">
        <a href="/" className="text-amber-400">
          ← Voltar
        </a>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            className={`rounded px-3 py-1 ${mode === "vertical" ? "bg-amber-400 text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}
            onClick={() => setMode("vertical")}
          >
            Vertical
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1 ${mode === "paged" ? "bg-amber-400 text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}
            onClick={() => setMode("paged")}
          >
            Paginado
          </button>
        </div>
      </header>
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
                  className="block w-full"
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
            />
          )}
          <nav className="flex justify-between gap-4 p-6">
            {previous ? (
              <a
                href={`/reader/${provider}/${previous.providerId}?manga=${mangaId ?? ""}`}
                className="rounded bg-zinc-800 px-4 py-2"
              >
                ← Capítulo anterior
              </a>
            ) : (
              <span />
            )}
            {next ? (
              <a
                href={`/reader/${provider}/${next.providerId}?manga=${mangaId ?? ""}`}
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

function PagedPage({
  pageUrl,
  pageIndex,
  pageCount,
  failed,
  onLoad,
  onError,
  onPrevious,
  onNext,
}: {
  pageUrl: string;
  pageIndex: number;
  pageCount: number;
  failed: boolean;
  onLoad: () => void;
  onError: () => void;
  onPrevious: () => void;
  onNext: () => void;
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
          className="mx-auto max-h-[calc(100vh-150px)] max-w-full object-contain"
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
