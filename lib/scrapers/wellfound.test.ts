import { describe, expect, it } from "vitest";
import { OpportunitySource } from "@prisma/client";
import { parseWellfoundJobsHtml } from "./wellfound";
import { loadFixture } from "./test-utils";

describe("parseWellfoundJobsHtml", () => {
  it("extracts JobSearchCard entries and absolutizes relative hrefs", () => {
    const html = loadFixture("wellfound.html");
    const listings = parseWellfoundJobsHtml(html);
    expect(listings).toHaveLength(2);
    expect(listings[0]).toMatchObject({
      source: OpportunitySource.WELLFOUND,
      title: "Platform Engineer",
      company: "Soylent",
      sourceUrl: "https://wellfound.com/jobs/123-platform-engineer",
    });
    expect(listings[1].sourceUrl).toBe(
      "https://wellfound.com/jobs/456-founding-engineer",
    );
  });
});
