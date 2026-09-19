import {
  type AnimeDetails,
  type AnimeEpisode,
  type AnimeSource,
  type AnimeStream,
  type AnimeSummary,
  animeDetailsSchema,
  animeEpisodeListSchema,
  animeLibraryResponseSchema,
  animeSearchResponseSchema,
  animeSourceListResponseSchema,
  animeStreamResponseSchema,
} from "@taiju/contracts";
import { useEffect, useRef, useState } from "react";
import { authenticatedHeaders } from "./lib/auth";

const debounceMs = 350;

export function AnimePage() {
  const match = window.location.pathname.match(/^\/anime\/([^/]+)\/(.+)$/);
  if (match === null) return <AnimeSearchPage />;
  const [, sourceId, animeId] = match;
  if (sourceId === undefined || animeId === undefined) return <AnimeSearchPage />;
  return (
    <AnimeDetailsPage
      animeId={decodeURIComponent(animeId)}
      sourceId={decodeURIComponent(sourceId)}
    />
  );
}

function AnimeSearchPage() {
  const [sources, setSources] = useState<AnimeSource[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<AnimeSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/anime/sources", {
      headers: authenticatedHeaders(),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("O catálogo de anime não está disponível agora.");
        return animeSourceListResponseSchema.parse(await response.json());
      })
      .then((payload) => {
        setSources(payload.items);
        setSourceId(payload.items[0]?.id ?? "");
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar as fontes de anime.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery === "" || sourceId === "") {
      setItems([]);
      setIsSearching(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const url = new URLSearchParams({ q: normalizedQuery, source: sourceId });
        const response = await fetch(`/api/anime/search?${url}`, {
          headers: authenticatedHeaders(),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("A busca de anime não está disponível agora.");
        setItems(animeSearchResponseSchema.parse(await response.json()).items);
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível buscar animes.",
          );
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, debounceMs);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, sourceId]);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-50 sm:px-6 sm:py-16">
      <section className="mx-auto max-w-6xl">
        <a className="text-sm text-amber-300 underline" href="/">
          ← Mangás
        </a>
        <p className="mt-8 text-sm font-medium tracking-[0.3em] text-amber-400 uppercase">
          Taiju Anime
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Encontre seu próximo anime
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-300">
          As fontes de anime são instaladas e mantidas separadamente do leitor de mangás.
        </p>
        <label className="mt-8 block max-w-2xl">
          <span className="mb-2 block text-sm text-zinc-400">Fonte</span>
          <select
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-amber-400"
            disabled={isLoading || sources.length === 0}
            onChange={(event) => setSourceId(event.target.value)}
            value={sourceId}
          >
            {sources.length === 0 ? (
              <option value="">Nenhuma fonte instalada</option>
            ) : (
              sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name} · {source.language}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="mt-4 block max-w-2xl">
          <span className="mb-2 block text-sm text-zinc-400">Buscar anime</span>
          <input
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base outline-none placeholder:text-zinc-500 focus:border-amber-400"
            disabled={sourceId === ""}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex.: Frieren"
            value={query}
          />
        </label>
        {isLoading && <p className="mt-8 text-zinc-300">Carregando fontes…</p>}
        {!isLoading && sources.length === 0 && !error && (
          <p className="mt-8 max-w-2xl rounded-xl border border-amber-900 bg-amber-950/30 p-4 text-amber-100">
            O runtime de anime está pronto, mas ainda não há uma fonte instalada. Use o túnel administrativo privado da VPS para configurar fontes confiáveis.
          </p>
        )}
        {isSearching && <p className="mt-8 text-zinc-300">Buscando animes…</p>}
        {error && <p className="mt-8 text-red-300" role="alert">{error}</p>}
        {!isSearching && !error && query.trim() !== "" && items.length === 0 && (
          <p className="mt-8 text-zinc-300">Nenhum anime encontrado.</p>
        )}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((anime) => (
            <a
              className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition hover:border-amber-400"
              href={`/anime/${encodeURIComponent(anime.source.sourceId)}/${encodeURIComponent(anime.source.externalId)}`}
              key={`${anime.source.sourceId}:${anime.source.externalId}`}
            >
              <div className="aspect-[2/3] bg-zinc-800">
                {anime.coverUrl && (
                  <img
                    alt={`Capa de ${anime.title}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    src={anime.coverUrl}
                  />
                )}
              </div>
              <div className="p-4">
                <h2 className="font-semibold">{anime.title}</h2>
                {anime.tags.length > 0 && (
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-400">
                    {anime.tags.join(" · ")}
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

function AnimeDetailsPage({
  animeId,
  sourceId,
}: {
  animeId: string;
  sourceId: string;
}) {
  const [anime, setAnime] = useState<AnimeDetails | null>(null);
  const [episodes, setEpisodes] = useState<AnimeEpisode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<AnimeEpisode | null>(null);
  const [streams, setStreams] = useState<AnimeStream[]>([]);
  const [selectedStream, setSelectedStream] = useState<AnimeStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const lastProgressSync = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const path = `/api/anime/${encodeURIComponent(sourceId)}/${encodeURIComponent(animeId)}`;
    void Promise.all([
      fetch(path, { headers: authenticatedHeaders(), signal: controller.signal }),
      fetch(`${path}/episodes`, {
        headers: authenticatedHeaders(),
        signal: controller.signal,
      }),
    ])
      .then(async ([detailsResponse, episodesResponse]) => {
        if (!detailsResponse.ok || !episodesResponse.ok)
          throw new Error("Os detalhes do anime não estão disponíveis agora.");
        setAnime(animeDetailsSchema.parse(await detailsResponse.json()));
        setEpisodes(animeEpisodeListSchema.parse(await episodesResponse.json()).items);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar este anime.",
          );
      });
    return () => controller.abort();
  }, [animeId, sourceId]);

  useEffect(() => {
    if (authenticatedHeaders() === undefined) return;
    const controller = new AbortController();
    void fetch("/api/anime/library", {
      headers: authenticatedHeaders(),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = animeLibraryResponseSchema.parse(await response.json());
        setIsFavorite(
          payload.items.some(
            (item) =>
              item.anime.sourceId === sourceId &&
              item.anime.externalId === animeId,
          ),
        );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [animeId, sourceId]);

  async function toggleFavorite() {
    const response = await fetch(
      `/api/anime/library/${encodeURIComponent(sourceId)}/${encodeURIComponent(animeId)}`,
      { headers: authenticatedHeaders(), method: isFavorite ? "DELETE" : "PUT" },
    );
    if (!response.ok) {
      setError("Não foi possível atualizar sua lista de animes.");
      return;
    }
    setIsFavorite((current) => !current);
  }

  async function selectEpisode(episode: AnimeEpisode) {
    setSelectedEpisode(episode);
    setSelectedStream(null);
    setStreams([]);
    lastProgressSync.current = 0;
    setError(null);
    try {
      const response = await fetch(
        `/api/anime/episodes/${encodeURIComponent(sourceId)}/${encodeURIComponent(episode.source.externalId)}/streams`,
        { headers: authenticatedHeaders() },
      );
      if (!response.ok) throw new Error("Não foi possível carregar os streams deste episódio.");
      const payload = animeStreamResponseSchema.parse(await response.json());
      setStreams(payload.items);
      setSelectedStream(payload.items.find((stream) => stream.isPreferred) ?? payload.items[0] ?? null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar os streams deste episódio.",
      );
    }
  }

  if (error && anime === null)
    return <main className="min-h-screen bg-zinc-950 p-8 text-red-300">{error}</main>;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-50 sm:px-6 sm:py-16">
      <section className="mx-auto max-w-6xl">
        <a className="text-sm text-amber-300 underline" href="/anime">← Animes</a>
        {anime === null ? (
          <p className="mt-8 text-zinc-300">Carregando anime…</p>
        ) : (
          <>
            <div className="mt-8 grid gap-8 md:grid-cols-[14rem_1fr]">
              <div className="aspect-[2/3] overflow-hidden rounded-xl bg-zinc-800">
                {anime.coverUrl && (
                  <img alt={`Capa de ${anime.title}`} className="h-full w-full object-cover" src={anime.coverUrl} />
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold sm:text-5xl">{anime.title}</h1>
                {authenticatedHeaders() !== undefined && (
                  <button
                    className="mt-4 min-h-11 rounded-lg border border-amber-400 px-4 py-2 text-sm text-amber-300 hover:bg-amber-400/10"
                    onClick={() => void toggleFavorite()}
                    type="button"
                  >
                    {isFavorite ? "Remover da minha lista" : "Adicionar à minha lista"}
                  </button>
                )}
                {anime.tags.length > 0 && <p className="mt-4 text-sm text-amber-300">{anime.tags.join(" · ")}</p>}
                {anime.description && <p className="mt-6 max-w-3xl whitespace-pre-wrap text-zinc-300">{anime.description}</p>}
              </div>
            </div>
            {selectedStream && (
              <section className="mt-10">
                <h2 className="text-2xl font-bold">{selectedEpisode?.title}</h2>
                {/* Caption tracks are provided dynamically by the selected stream when available. */}
                {/* biome-ignore lint/a11y/useMediaCaption: source extensions do not always expose captions. */}
                <video
                  className="mt-4 aspect-video w-full rounded-xl bg-black"
                  controls
                  preload="metadata"
                  src={`/api/anime/streams/${selectedStream.playbackId}`}
                  onTimeUpdate={(event) => {
                    if (selectedEpisode === null || authenticatedHeaders() === undefined)
                      return;
                    const positionSeconds = Math.floor(event.currentTarget.currentTime);
                    if (positionSeconds < lastProgressSync.current + 10) return;
                    lastProgressSync.current = positionSeconds;
                    void fetch("/api/anime/watch-progress", {
                      body: JSON.stringify({
                        anime: { externalId: animeId, sourceId },
                        durationSeconds: Number.isFinite(event.currentTarget.duration)
                          ? Math.floor(event.currentTarget.duration)
                          : undefined,
                        episode: selectedEpisode.source,
                        positionSeconds,
                      }),
                      headers: {
                        ...authenticatedHeaders(),
                        "Content-Type": "application/json",
                      },
                      method: "PUT",
                    });
                  }}
                >
                  {selectedStream.subtitleTracks.map((track, index) => (
                    <track
                      default={index === 0}
                      key={track.url}
                      kind="subtitles"
                      label={track.label}
                      src={track.url}
                      srcLang={track.label.slice(0, 2).toLowerCase()}
                    />
                  ))}
                  Seu navegador não suporta reprodução de vídeo.
                </video>
                {streams.length > 1 && (
                  <label className="mt-3 block max-w-sm text-sm text-zinc-300">
                    <span className="mb-1 block">Qualidade</span>
                    <select
                      className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3"
                      onChange={(event) =>
                        setSelectedStream(
                          streams.find((stream) => stream.playbackId === event.target.value) ?? null,
                        )
                      }
                      value={selectedStream.playbackId}
                    >
                      {streams.map((stream) => (
                        <option key={stream.playbackId} value={stream.playbackId}>
                          {stream.title}{stream.quality ? ` · ${stream.quality}p` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </section>
            )}
            {error && <p className="mt-6 text-red-300" role="alert">{error}</p>}
            <section className="mt-10">
              <h2 className="text-2xl font-bold">Episódios</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {episodes.map((episode) => (
                  <button
                    className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-left hover:border-amber-400"
                    key={`${episode.source.sourceId}:${episode.source.externalId}`}
                    onClick={() => void selectEpisode(episode)}
                    type="button"
                  >
                    {episode.number === undefined ? "" : `Episódio ${episode.number} · `}
                    {episode.title}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
