import type {
  GourmetDraftSummary,
  McpActor,
  McpGourmetPort,
} from "@arlequins/agent-mcp";
import { z } from "zod";

export const DEFAULT_BEAT_GOURMET_API_URL =
  "https://4kfwvp7y2qoprape5p2jr5qvra0ekgcl.lambda-url.ap-northeast-1.on.aws";

const responseSchema = z.object({
  entries: z.array(
    z.object({
      id: z.string(),
      images: z.array(z.unknown()).default([]),
      menuName: z.string(),
      rating: z.number(),
      restaurantName: z.string(),
      revisit: z.enum(["yes", "no", "unknown"]),
      slug: z.string(),
      status: z.literal("draft"),
      updatedAt: z.string(),
      visitedAt: z.string().nullable(),
    }),
  ),
});

export type BeatGourmetReadClientOptions = {
  accessToken: string;
  apiUrl: string;
  fetch?: typeof globalThis.fetch;
};

function endpoint(apiUrl: string, limit: number) {
  const url = new URL("/api/gourmet/entries", apiUrl);
  url.searchParams.set("status", "draft");
  url.searchParams.set("page", "1");
  url.searchParams.set("pageSize", String(limit));
  return url;
}

export function createBeatGourmetReadClient(
  options: BeatGourmetReadClientOptions,
): McpGourmetPort {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  return {
    async listDrafts(_actor: McpActor, limit: number) {
      const response = await fetchImpl(endpoint(options.apiUrl, limit), {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${options.accessToken}`,
        },
        signal: AbortSignal.timeout(5_000),
      });
      if (response.status === 401 || response.status === 403)
        throw new Error("Beat Gourmet draft access is not authorized");
      if (!response.ok)
        throw new Error(
          `Beat Gourmet draft lookup failed (${response.status})`,
        );

      const payload = responseSchema.parse(await response.json());
      return payload.entries.map(
        (entry): GourmetDraftSummary => ({
          id: entry.id,
          imageCount: entry.images.length,
          menuName: entry.menuName,
          rating: entry.rating,
          restaurantName: entry.restaurantName,
          revisit: entry.revisit,
          slug: entry.slug,
          status: entry.status,
          updatedAt: entry.updatedAt,
          visitedAt: entry.visitedAt,
        }),
      );
    },
  };
}
