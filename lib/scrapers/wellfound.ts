import { OpportunitySource, type RolePreference } from "@prisma/client";
import { decode, stripTags } from "./html-entities";
import type { JobSearchAdapter, RawListing } from "./types";

// Wellfound renders each posting as a <div data-test="JobSearchCard">
// containing a job title link and a company anchor. Snippets are not
// always present; tolerated as empty.
const CARD_PATTERN =
  /<div[^>]*data-test="JobSearchCard"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
const TITLE_PATTERN =
  /<a[^>]*data-test="job-title-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
const COMPANY_PATTERN =
  /<a[^>]*data-test="startup-link"[^>]*>([\s\S]*?)<\/a>/;
const SNIPPET_PATTERN =
  /<div[^>]*data-test="job-description"[^>]*>([\s\S]*?)<\/div>/;

function extractCard(cardHtml: string): RawListing | null {
  const title = TITLE_PATTERN.exec(cardHtml);
  const company = COMPANY_PATTERN.exec(cardHtml);
  if (!title || !company) return null;
  const snippet = SNIPPET_PATTERN.exec(cardHtml);
  const href = title[1].startsWith("http")
    ? title[1]
    : `https://wellfound.com${title[1]}`;
  return {
    source: OpportunitySource.WELLFOUND,
    title: decode(stripTags(title[2])),
    company: decode(stripTags(company[1])),
    jdSnippet: decode(stripTags(snippet?.[1] ?? "")),
    sourceUrl: href,
  };
}

export function parseWellfoundJobsHtml(html: string): RawListing[] {
  const out: RawListing[] = [];
  for (const match of html.matchAll(CARD_PATTERN)) {
    const listing = extractCard(match[1]);
    if (listing) out.push(listing);
  }
  return out;
}

async function fetchWellfoundJobs(rolePrefs: RolePreference): Promise<string> {
  const keywords = (rolePrefs.targetRoles[0] ?? "").trim();
  const url = `https://wellfound.com/jobs?role=${encodeURIComponent(keywords)}`;
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

export const wellfoundAdapter: JobSearchAdapter = {
  source: OpportunitySource.WELLFOUND,
  parseHtml: parseWellfoundJobsHtml,
  async searchJobs(rolePrefs) {
    const html = await fetchWellfoundJobs(rolePrefs);
    return parseWellfoundJobsHtml(html);
  },
};
