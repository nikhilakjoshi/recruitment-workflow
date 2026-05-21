// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/ui/toast", () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

import { CoverLetterEditor } from "./cover-letter-editor";
import type { CoverLetter } from "@/lib/schemas/cover-letter";

afterEach(() => cleanup());

const INITIAL: CoverLetter = {
  recipient: { name: "Hiring Team", company: "Acme Inc" },
  paragraphs: [
    {
      kind: "OPENING",
      text: "Writing about the Senior Backend Engineer role at Acme.",
    },
    { kind: "WHY_ME", text: "Eight years of distributed systems work." },
    { kind: "WHY_YOU", text: "Acme's bet on backend reliability resonates." },
    { kind: "CLOSE", text: "Happy to share more in a conversation." },
  ],
  signoff: "Sincerely,",
  signature: "Jane Doe",
};

describe("CoverLetterEditor", () => {
  it("renders one textarea per paragraph kind with the correct labels", () => {
    render(
      <CoverLetterEditor
        applicationId="app_1"
        artifactId="art_1"
        initial={INITIAL}
        onSaveNewVersion={vi.fn()}
        onRegenerateAll={vi.fn()}
      />,
    );
    for (const label of ["Opening", "Why me", "Why you", "Close"]) {
      expect(screen.getByRole("textbox", { name: label })).toBeDefined();
    }
  });

  it("Regenerate-all button calls the action exactly once", async () => {
    const onRegenerateAll = vi
      .fn()
      .mockResolvedValue({ ok: true, value: { requested: true } });
    render(
      <CoverLetterEditor
        applicationId="app_1"
        artifactId="art_1"
        initial={INITIAL}
        onSaveNewVersion={vi.fn()}
        onRegenerateAll={onRegenerateAll}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Regenerate all/i }));
    await new Promise((r) => setTimeout(r, 0));
    expect(onRegenerateAll).toHaveBeenCalledTimes(1);
    expect(onRegenerateAll).toHaveBeenCalledWith("app_1");
  });

  it("Save-as-new-version sends the edited letter content", async () => {
    const onSave = vi
      .fn()
      .mockResolvedValue({ ok: true, value: { artifactId: "art_2" } });
    render(
      <CoverLetterEditor
        applicationId="app_1"
        artifactId="art_1"
        initial={INITIAL}
        onSaveNewVersion={onSave}
        onRegenerateAll={vi.fn()}
      />,
    );

    const opening = screen.getByRole("textbox", { name: "Opening" }) as HTMLTextAreaElement;
    fireEvent.change(opening, {
      target: {
        value:
          "Updated opening paragraph that is comfortably above the schema's 20-character minimum.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /Save as new version/i }));
    await new Promise((r) => setTimeout(r, 0));
    expect(onSave).toHaveBeenCalledTimes(1);
    const arg = onSave.mock.calls[0]![2] as CoverLetter;
    const updatedOpening = arg.paragraphs.find((p) => p.kind === "OPENING");
    expect(updatedOpening?.text).toMatch(/Updated opening paragraph/);
  });
});
