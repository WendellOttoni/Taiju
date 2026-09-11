import { z } from "zod";
import type { MangaDexClient } from "./client";
import { MangaDexContentUnavailableError } from "./errors";

const responseSchema = z.object({
  baseUrl: z.string().url(),
  chapter: z.object({
    hash: z.string(),
    data: z.array(z.string()),
  }),
});

export type MangaDexChapterPages = { chapterId: string; pages: string[] };

export async function resolveChapterPages(
  client: Pick<MangaDexClient, "request">,
  chapterId: string,
): Promise<MangaDexChapterPages> {
  const parsed = responseSchema.safeParse(
    await (await client.request(`/at-home/server/${chapterId}`)).json(),
  );
  if (
    !parsed.success ||
    parsed.data.chapter.hash.trim().length === 0 ||
    parsed.data.chapter.data.length === 0 ||
    parsed.data.chapter.data.some((fileName) => fileName.trim().length === 0)
  )
    throw new MangaDexContentUnavailableError();
  const payload = parsed.data;
  const baseUrl = new URL(payload.baseUrl);
  if (baseUrl.protocol !== "https:")
    throw new Error("MangaDex@Home returned an insecure base URL.");
  return {
    chapterId,
    pages: payload.chapter.data.map((fileName) =>
      new URL(`/data/${payload.chapter.hash}/${fileName}`, baseUrl).toString(),
    ),
  };
}
