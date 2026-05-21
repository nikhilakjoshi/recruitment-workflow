import { OpportunitySource, type RolePreference } from "@prisma/client";
import { decode } from "./html-entities";
import type { JobSearchAdapter, RawListing } from "./types";

// LinkedIn public job listings render each card with a base-card structure
// containing the title, company, and a snippet of the JD. We pull those
// three fields via regex against the loaded HTML — Playwright loads the
// authenticated session-cookie page in production, but the parser itself
// is pure.
const CARD_PATTERN =
  /<li[^>]*class="[^"]*base-card[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
const TITLE_PATTERN =
  /<(?:h3|a)[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/(?:h3|a)>/;
const COMPANY_PATTERN =
  /<(?:h4|a)[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/(?:h4|a)>/;
const SNIPPET_PATTERN =
  /<p[^>]*class="[^"]*base-search-card__snippet[^"]*"[^>]*>([\s\S]*?)<\/p>/;
const HREF_PATTERN =
  /<a[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]+)"/;

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractCard(cardHtml: string): RawListing | null {
  const title = TITLE_PATTERN.exec(cardHtml);
  const company = COMPANY_PATTERN.exec(cardHtml);
  if (!title || !company) return null;
  const snippet = SNIPPET_PATTERN.exec(cardHtml);
  const href = HREF_PATTERN.exec(cardHtml);
  return {
    source: OpportunitySource.LINKEDIN,
    title: decode(stripTags(title[1])),
    company: decode(stripTags(company[1])),
    jdSnippet: decode(stripTags(snippet?.[1] ?? "")),
    sourceUrl: href?.[1] ?? null,
  };
}

export function parseLinkedInJobsHtml(html: string): RawListing[] {
  const out: RawListing[] = [];
  for (const match of html.matchAll(CARD_PATTERN)) {
    const listing = extractCard(match[1]);
    if (listing) out.push(listing);
  }
  return out;
}

async function fetchLinkedInJobs(rolePrefs: RolePreference): Promise<string> {
  const cookie = process.env.LINKEDIN_SESSION_COOKIE;
  if (!cookie) {
    throw new Error("LINKEDIN_SESSION_COOKIE not set — skipping LinkedIn scrape");
  }
  const keywords = (rolePrefs.targetRoles[0] ?? "").trim();
  const location = (rolePrefs.geoLocations[0] ?? "").trim();
  const url = `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(
    keywords,
  )}&location=${encodeURIComponent(location)}`;
  // Lazy-import so test code paths don't need playwright at all.
  const { chromium } = await import("playwright-core");
  const chromiumMin = (await import("@sparticuz/chromium-min")).default;
  const browser = await chromium.launch({
    args: chromiumMin.args,
    executablePath: await chromiumMin.executablePath(),
    headless: true,
  });
  try {
    const ctx = await browser.newContext({
      extraHTTPHeaders: { cookie: `li_at=${cookie}` },
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    return await page.content();
  } finally {
    await browser.close();
  }
}

export const linkedInAdapter: JobSearchAdapter = {
  source: OpportunitySource.LINKEDIN,
  parseHtml: parseLinkedInJobsHtml,
  async searchJobs(rolePrefs) {
    const html = await fetchLinkedInJobs(rolePrefs);
    return parseLinkedInJobsHtml(html);
  },
};
