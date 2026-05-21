export type Freshness = "pd" | "pw" | "pm" | "py";

export type SearchOptions = {
  freshness?: Freshness;
  count?: number;
};

export type SearchResult = {
  title: string;
  description: string;
  url: string;
  publishedDate?: string;
};

const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

type BraveWebResult = {
  title?: string;
  description?: string;
  url?: string;
  age?: string;
  page_age?: string;
};

type BraveSearchResponse = {
  web?: {
    results?: BraveWebResult[];
  };
};

export async function search(
  query: string,
  opts: SearchOptions = {},
): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    throw new Error("BRAVE_SEARCH_API_KEY is not set");
  }

  const params = new URLSearchParams({ q: query });
  if (opts.freshness) params.set("freshness", opts.freshness);
  if (opts.count) params.set("count", String(opts.count));

  const url = `${BRAVE_ENDPOINT}?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Brave Search failed: ${response.status} ${response.statusText} ${body.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as BraveSearchResponse;
  const rows = data.web?.results ?? [];
  return rows.slice(0, opts.count ?? rows.length).map((r) => ({
    title: r.title ?? "(no title)",
    description: r.description ?? "",
    url: r.url ?? "",
    publishedDate: r.page_age ?? r.age,
  }));
}
