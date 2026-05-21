import { describe, expect, it } from "vitest";
import { OpportunitySource } from "@prisma/client";
import { parseIndeedJobsHtml } from "./indeed";
import { loadFixture } from "./test-utils";

describe("parseIndeedJobsHtml", () => {
  it("extracts each job_seen_beacon card from fixture", () => {
    const html = loadFixture("indeed.html");
    const listings = parseIndeedJobsHtml(html);
    expect(listings).toHaveLength(2);
    expect(listings[0]).toEqual({
      source: OpportunitySource.INDEED,
      title: "Backend Engineer",
      company: "Globex",
      jdSnippet: "Node.js, Postgres, and friends.",
      sourceUrl: "https://www.indeed.com/viewjob?jk=abc123",
    });
    expect(listings[1].title).toBe("Full-Stack Engineer");
    expect(listings[1].sourceUrl).toBe("https://www.indeed.com/viewjob?jk=def456");
  });
});
