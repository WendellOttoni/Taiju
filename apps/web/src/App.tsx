import { type MangaSummary, mangaSearchResponseSchema } from "@taiju/contracts";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

const debounceMs = 350;

export function App() {
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
            <article
              key={`${manga.provider}:${manga.providerId}`}
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
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
