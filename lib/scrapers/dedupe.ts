import { createHash } from "node:crypto";
import type { RawListing } from "./types";

// Normalize a job title for hashing: lowercase, strip parenthetical
// suffixes (e.g. "(Remote)"), collapse whitespace, drop common seniority
// noise that would split otherwise-identical postings.
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Stable hash of (company, normalized-title) — collisions across sources
// indicate the same posting cross-listed, and within one source they
// indicate a re-fetched duplicate.
export function listingHash(listing: Pick<RawListing, "company" | "title">): string {
  const key = `${listing.company.toLowerCase().trim()}::${normalizeTitle(listing.title)}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

// Dedupe a flat array of listings across sources. First occurrence wins,
// preserving source order from the aggregator.
export function dedupeListings(listings: RawListing[]): RawListing[] {
  const seen = new Set<string>();
  const out: RawListing[] = [];
  for (const l of listings) {
    const h = listingHash(l);
    if (seen.has(h)) continue;
    seen.add(h);
    out.push(l);
  }
  return out;
}
