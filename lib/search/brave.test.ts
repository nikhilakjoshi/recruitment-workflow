import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { search } from "./brave";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_KEY = process.env.BRAVE_SEARCH_API_KEY;

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_KEY === undefined) {
    delete process.env.BRAVE_SEARCH_API_KEY;
  } else {
    process.env.BRAVE_SEARCH_API_KEY = ORIGINAL_KEY;
  }
});

describe("brave search client", () => {
  beforeEach(() => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
  });

  it("hits the brave web search endpoint with the API key header and query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        web: {
          results: [
            {
              title: "Acme raises $50M",
              description: "Acme announced a Series B...",
              url: "https://news.example.com/acme",
              page_age: "2025-12-01T00:00:00Z",
            },
          ],
        },
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const results = await search("Acme news", { freshness: "pm", count: 5 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("https://api.search.brave.com/res/v1/web/search");
    expect(url).toContain("q=Acme+news");
    expect(url).toContain("freshness=pm");
    expect(url).toContain("count=5");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Subscription-Token"]).toBe("test-key");
    expect(headers["Accept"]).toBe("application/json");

    expect(results).toEqual([
      {
        title: "Acme raises $50M",
        description: "Acme announced a Series B...",
        url: "https://news.example.com/acme",
        publishedDate: "2025-12-01T00:00:00Z",
      },
    ]);
  });

  it("throws if BRAVE_SEARCH_API_KEY is not set", async () => {
    delete process.env.BRAVE_SEARCH_API_KEY;
    await expect(search("anything")).rejects.toThrow(/BRAVE_SEARCH_API_KEY/);
  });

  it("throws on non-2xx HTTP response with status code visible", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: async () => "rate-limited",
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await expect(search("foo")).rejects.toThrow(/429/);
  });

  it("returns an empty list when web.results is missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    expect(await search("nothing here")).toEqual([]);
  });

  it("respects count limit by trimming overflow results", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        web: {
          results: [
            { title: "a", description: "", url: "a" },
            { title: "b", description: "", url: "b" },
            { title: "c", description: "", url: "c" },
          ],
        },
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const out = await search("z", { count: 2 });
    expect(out).toHaveLength(2);
    expect(out[0].title).toBe("a");
    expect(out[1].title).toBe("b");
  });
});
