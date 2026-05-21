import { describe, expect, it } from "vitest";
import { OpportunitySource } from "@prisma/client";
import { dedupeListings, listingHash, normalizeTitle } from "./dedupe";
import type { RawListing } from "./types";

function listing(partial: Partial<RawListing>): RawListing {
  return {
    source: OpportunitySource.LINKEDIN,
    title: "Engineer",
    company: "Acme",
    jdSnippet: "",
    sourceUrl: null,
    ...partial,
  };
}

describe("normalizeTitle", () => {
  it("strips parenthetical suffixes and collapses whitespace", () => {
    expect(normalizeTitle("Senior Engineer  (Remote)")).toBe("senior engineer");
  });
});

describe("listingHash", () => {
  it("is stable across (company, normalized-title) equality", () => {
    const a = listingHash({ company: "Acme", title: "Senior Engineer (Remote)" });
    const b = listingHash({ company: "acme", title: "senior engineer" });
    expect(a).toBe(b);
  });

  it("differs when title actually differs", () => {
    expect(
      listingHash({ company: "Acme", title: "Senior Engineer" }),
    ).not.toBe(listingHash({ company: "Acme", title: "Staff Engineer" }));
  });
});

describe("dedupeListings", () => {
  it("keeps first occurrence and drops cross-source duplicates", () => {
    const out = dedupeListings([
      listing({ source: OpportunitySource.LINKEDIN, title: "Senior Engineer (Remote)" }),
      listing({ source: OpportunitySource.INDEED, title: "Senior Engineer" }),
      listing({ source: OpportunitySource.WELLFOUND, title: "Staff Engineer" }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].source).toBe(OpportunitySource.LINKEDIN);
    expect(out[1].title).toBe("Staff Engineer");
  });
});
