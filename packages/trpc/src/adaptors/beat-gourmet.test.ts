import { describe, expect, it, vi } from "vitest";

import { createBeatGourmetReadClient } from "./beat-gourmet";

describe("Beat Gourmet read client", () => {
  it("forwards the request-scoped token only to the fixed API path and redacts images", async () => {
    let requestUrl = "";
    let authorization = "";
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requestUrl = String(input);
        authorization = String(new Headers(init?.headers).get("authorization"));
        return new Response(
          JSON.stringify({
            entries: [
              {
                id: "entry-1",
                images: [
                  {
                    storageKey: "private/should-not-be-returned",
                  },
                ],
                menuName: "카레",
                rating: 8,
                restaurantName: "Beat 식당",
                revisit: "yes",
                slug: "beat-restaurant-1",
                status: "draft",
                updatedAt: "2026-08-24T00:00:00.000Z",
                visitedAt: "2026-08-23",
              },
            ],
          }),
          { headers: { "content-type": "application/json" }, status: 200 },
        );
      },
    );
    const client = createBeatGourmetReadClient({
      accessToken: "oidc-access-token",
      apiUrl:
        "https://4kfwvp7y2qoprape5p2jr5qvra0ekgcl.lambda-url.ap-northeast-1.on.aws",
      fetch: fetchMock,
    });

    await expect(
      client.listDrafts({ userId: "user-1", workspaceId: "workspace-1" }, 3),
    ).resolves.toEqual([
      {
        id: "entry-1",
        imageCount: 1,
        menuName: "카레",
        rating: 8,
        restaurantName: "Beat 식당",
        revisit: "yes",
        slug: "beat-restaurant-1",
        status: "draft",
        updatedAt: "2026-08-24T00:00:00.000Z",
        visitedAt: "2026-08-23",
      },
    ]);
    expect(requestUrl).toContain("/api/gourmet/entries?status=draft");
    expect(requestUrl).toContain("pageSize=3");
    expect(authorization).toBe("Bearer oidc-access-token");
  });

  it("maps authorization failures without exposing response details", async () => {
    const client = createBeatGourmetReadClient({
      accessToken: "oidc-access-token",
      apiUrl:
        "https://4kfwvp7y2qoprape5p2jr5qvra0ekgcl.lambda-url.ap-northeast-1.on.aws",
      fetch: vi.fn(
        async () => new Response("secret response", { status: 403 }),
      ),
    });

    await expect(
      client.listDrafts({ userId: "user-1", workspaceId: "workspace-1" }, 3),
    ).rejects.toThrow("Beat Gourmet draft access is not authorized");
  });
});
