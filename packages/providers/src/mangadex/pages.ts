import { z } from "zod";
import type { MangaDexClient } from "./client";

const responseSchema = z.object({
  baseUrl: z.string().url(),
  chapter: z.object({
    hash: z.string().min(1),
    data: z.array(z.string().min(1)),
  }),
});

export type MangaDexChapterPages = { chapterId: string; pages: string[] };

export async function resolveChapterPages(
  client: Pick<MangaDexClient, "request">,
  chapterId: string,
): Promise<MangaDexChapterPages> {
  const payload = responseSchema.parse(
    await (await client.request(`/at-home/server/${chapterId}`)).json(),
  );
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
