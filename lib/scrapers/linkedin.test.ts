import { describe, expect, it } from "vitest";
import { OpportunitySource } from "@prisma/client";
import { parseLinkedInJobsHtml } from "./linkedin";
import { loadFixture } from "./test-utils";

describe("parseLinkedInJobsHtml", () => {
  it("extracts title/company/snippet/sourceUrl for each card in fixture", () => {
    const html = loadFixture("linkedin.html");
    const listings = parseLinkedInJobsHtml(html);
    expect(listings).toHaveLength(2);
    expect(listings[0]).toEqual({
      source: OpportunitySource.LINKEDIN,
      title: "Senior Software Engineer",
      company: "Acme Corp",
      jdSnippet: "Build distributed systems & ship things.",
      sourceUrl: "https://www.linkedin.com/jobs/view/12345",
    });
    expect(listings[1].title).toBe("Staff Engineer (Remote)");
    expect(listings[1].company).toBe("Beta Industries");
  });

  it("returns empty when no base-card elements present", () => {
    expect(parseLinkedInJobsHtml("<html><body></body></html>")).toEqual([]);
  });
});
