import {
  type MangaDetails,
  type MangaSummary,
  mangaDetailsSchema,
  mangaSearchResponseSchema,
} from "@taiju/contracts";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

const debounceMs = 350;

export function App() {
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
