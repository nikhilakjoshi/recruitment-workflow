import { describe, expect, it } from "vitest";
import pdfParse from "pdf-parse";
import { renderResumeToPDF, renderCoverLetterToPDF } from "./render";
import type { TailoredResume } from "@/lib/schemas/tailored-resume";
import type { CoverLetter } from "@/lib/schemas/cover-letter";

const RESUME: TailoredResume = {
  candidateName: "Jane Doe",
  contactBlock: {
    email: "jane@example.com",
    phone: "+1-555-1234",
    linkedinUrl: "https://linkedin.com/in/janedoe",
    location: "Remote",
  },
  sections: [
    { type: "HEADER", title: "Jane Doe", bullets: [], order: 0 },
    {
      type: "EXPERIENCE",
      title: "Experience",
      bullets: [
        {
          text: "Led monolith migration to microservices supporting 50M req per day.",
          rationale: "",
          evidenceFromMasterCV: "",
        },
      ],
      order: 1,
    },
  ],
  overallRationale:
    "Emphasizes distributed systems leadership and Go expertise per the JD's stated needs.",
};

const LETTER: CoverLetter = {
  recipient: { company: "Acme Inc", name: "Hiring Team" },
  paragraphs: [
    {
      kind: "OPENING",
      text: "Writing about the Senior Backend Engineer role — eight years of distributed systems work aligns with the JD.",
    },
    {
      kind: "WHY_ME",
      text: "The monolith-to-microservices migration I led sustained 50M req/day, and Go has been the day-to-day language.",
    },
    {
      kind: "WHY_YOU",
      text: "Acme's bet on backend reliability resonates with how I think about systems — quiet, durable craft.",
    },
    {
      kind: "CLOSE",
      text: "Kafka is one stretch I would close inside your environment. Happy to share more in a conversation.",
    },
  ],
  signoff: "Sincerely,",
  signature: "Jane Doe",
};

async function extractText(buf: Buffer): Promise<string> {
  const result = await pdfParse(buf);
  return result.text;
}

describe("PDF rendering", () => {
  it("renders a tailored resume to a non-empty PDF buffer", async () => {
    const buf = await renderResumeToPDF(RESUME);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("the resume PDF contains the candidate name and bullet text", async () => {
    const buf = await renderResumeToPDF(RESUME);
    const text = await extractText(buf);
    expect(text).toMatch(/Jane Doe/);
    expect(text).toMatch(/monolith/i);
  });

  it("renders a cover letter to a non-empty PDF buffer", async () => {
    const buf = await renderCoverLetterToPDF(LETTER);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("the cover letter PDF contains the recipient company and signature", async () => {
    const buf = await renderCoverLetterToPDF(LETTER);
    const text = await extractText(buf);
    expect(text).toMatch(/Acme Inc/);
    expect(text).toMatch(/Jane Doe/);
  });
});
