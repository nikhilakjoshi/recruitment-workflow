import { OpportunitySource, type RolePreference } from "@prisma/client";
import { decode } from "./html-entities";
import type { JobSearchAdapter, RawListing } from "./types";

// Indeed renders each result row as a <td class="resultContent"> inside
// a <div class="job_seen_beacon"> / <li> container. We anchor on the
// beacon container which is stable across recent layouts.
const CARD_PATTERN =
  /<li[^>]*class="[^"]*job_seen_beacon[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
const TITLE_PATTERN =
  /<(?:h2|a)[^>]*class="[^"]*jobTitle[^"]*"[^>]*>(?:[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>|([\s\S]*?))<\/(?:h2|a)>/;
const COMPANY_PATTERN =
  /<span[^>]*data-testid="company-name"[^>]*>([\s\S]*?)<\/span>/;
const SNIPPET_PATTERN =
  /<div[^>]*class="[^"]*job-snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/;
const HREF_PATTERN = /<a[^>]*data-jk="([^"]+)"/;

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractCard(cardHtml: string): RawListing | null {
  const title = TITLE_PATTERN.exec(cardHtml);
  const company = COMPANY_PATTERN.exec(cardHtml);
  if (!title || !company) return null;
  const snippet = SNIPPET_PATTERN.exec(cardHtml);
  const href = HREF_PATTERN.exec(cardHtml);
  const titleText = title[1] ?? title[2] ?? "";
  return {
    source: OpportunitySource.INDEED,
    title: decode(stripTags(titleText)),
    company: decode(stripTags(company[1])),
    jdSnippet: decode(stripTags(snippet?.[1] ?? "")),
    sourceUrl: href?.[1] ? `https://www.indeed.com/viewjob?jk=${href[1]}` : null,
  };
}

export function parseIndeedJobsHtml(html: string): RawListing[] {
  const out: RawListing[] = [];
  for (const match of html.matchAll(CARD_PATTERN)) {
    const listing = extractCard(match[1]);
    if (listing) out.push(listing);
  }
  return out;
}

async function fetchIndeedJobs(rolePrefs: RolePreference): Promise<string> {
  const keywords = (rolePrefs.targetRoles[0] ?? "").trim();
  const location = (rolePrefs.geoLocations[0] ?? "").trim();
  const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(
    keywords,
  )}&l=${encodeURIComponent(location)}`;
  const { chromium } = await import("playwright-core");
  const chromiumMin = (await import("@sparticuz/chromium-min")).default;
  const browser = await chromium.launch({
    args: chromiumMin.args,
    executablePath: await chromiumMin.executablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    return await page.content();
  } finally {
    await browser.close();
  }
}

export const indeedAdapter: JobSearchAdapter = {
  source: OpportunitySource.INDEED,
  parseHtml: parseIndeedJobsHtml,
  async searchJobs(rolePrefs) {
    const html = await fetchIndeedJobs(rolePrefs);
    return parseIndeedJobsHtml(html);
  },
};
