import type { OpportunitySource, RolePreference } from "@prisma/client";

// A raw listing as scraped from a board, before normalization, dedupe,
// ranking, or insertion as an Opportunity row.
export type RawListing = {
  source: OpportunitySource;
  title: string;
  company: string;
  jdSnippet: string;
  sourceUrl: string | null;
};

// Adapter for a single job board. `searchJobs` is the live entry point
// (uses Playwright internally); `parseHtml` is a pure function callable
// from tests against recorded fixtures.
export type JobSearchAdapter = {
  source: OpportunitySource;
  searchJobs(rolePrefs: RolePreference): Promise<RawListing[]>;
  parseHtml(html: string): RawListing[];
};

// Inputs passed to the aggregator's per-source scrape call. We only need
// the role-preference fields that drive the URL — the adapter decides
// what to use.
export type SearchInputs = Pick<
  RolePreference,
  "targetRoles" | "geoLocations" | "remotePolicy"
>;
