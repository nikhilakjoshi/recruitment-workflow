// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/ui/toast", () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

import { ResumeEditor } from "./resume-editor";
import type { TailoredResume } from "@/lib/schemas/tailored-resume";

afterEach(() => cleanup());

const INITIAL: TailoredResume = {
  candidateName: "Jane Doe",
  contactBlock: { email: "jane@example.com" },
  sections: [
    { type: "HEADER", title: "Jane Doe", bullets: [], order: 0 },
    {
      type: "EXPERIENCE",
      title: "Experience",
      order: 1,
      bullets: [
        {
          text: "Led monolith-to-microservices migration sustaining 50M req/day.",
          rationale: "",
          evidenceFromMasterCV: "",
        },
        {
          text: "Designed Postgres + pgvector pipeline for semantic retrieval at scale.",
          rationale: "",
          evidenceFromMasterCV: "",
        },
      ],
    },
  ],
  overallRationale:
    "Emphasizes distributed systems leadership and Go expertise per the JD's stated needs.",
};

describe("ResumeEditor", () => {
  it("renders each bullet's text in an editable textarea", () => {
    render(
      <ResumeEditor
        applicationId="app_1"
        artifactId="art_1"
        initial={INITIAL}
        onSaveNewVersion={vi.fn()}
        onRewriteBullet={vi.fn()}
      />,
    );
    expect(screen.getByRole("textbox", { name: /Bullet s1-b0/i })).toBeDefined();
    expect(screen.getByRole("textbox", { name: /Bullet s1-b1/i })).toBeDefined();
  });

  it("AI rewrite button calls the action and replaces the bullet text", async () => {
    const onRewriteBullet = vi
      .fn()
      .mockResolvedValue({ ok: true, value: { text: "Rewritten bullet text." } });

    render(
      <ResumeEditor
        applicationId="app_1"
        artifactId="art_1"
        initial={INITIAL}
        onSaveNewVersion={vi.fn()}
        onRewriteBullet={onRewriteBullet}
      />,
    );

    const buttons = screen.getAllByRole("button", { name: /AI rewrite/i });
    expect(buttons.length).toBeGreaterThan(0);
    fireEvent.click(buttons[0]!);

    await new Promise((r) => setTimeout(r, 0));
    expect(onRewriteBullet).toHaveBeenCalled();
    const textarea = (await screen.findByRole(
      "textbox",
      { name: /Bullet s1-b0/i },
    )) as HTMLTextAreaElement;
    expect(textarea.value).toBe("Rewritten bullet text.");
  });

  it("save-new-version calls the action with the current resume state", async () => {
    const onSave = vi
      .fn()
      .mockResolvedValue({ ok: true, value: { artifactId: "art_2" } });
    render(
      <ResumeEditor
        applicationId="app_1"
        artifactId="art_1"
        initial={INITIAL}
        onSaveNewVersion={onSave}
        onRewriteBullet={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Save as new version/i }));
    await new Promise((r) => setTimeout(r, 0));
    expect(onSave).toHaveBeenCalledTimes(1);
    const args = onSave.mock.calls[0]!;
    expect(args[0]).toBe("app_1");
    expect(args[1]).toBe("art_1");
    const resumeArg = args[2] as TailoredResume;
    expect(resumeArg.candidateName).toBe("Jane Doe");
    expect(resumeArg.sections[1]?.bullets).toHaveLength(2);
  });

  it("discard-changes reverts edited text back to the initial value", () => {
    render(
      <ResumeEditor
        applicationId="app_1"
        artifactId="art_1"
        initial={INITIAL}
        onSaveNewVersion={vi.fn()}
        onRewriteBullet={vi.fn()}
      />,
    );

    const textarea = screen.getByRole("textbox", {
      name: /Bullet s1-b0/i,
    }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Some local edit" } });
    expect(textarea.value).toBe("Some local edit");

    fireEvent.click(screen.getByRole("button", { name: /Discard changes/i }));
    const refreshed = screen.getByRole("textbox", {
      name: /Bullet s1-b0/i,
    }) as HTMLTextAreaElement;
    expect(refreshed.value).toBe(INITIAL.sections[1]!.bullets[0]!.text);
  });

  it("renders one drag handle per bullet so dnd-kit reorder is possible", () => {
    render(
      <ResumeEditor
        applicationId="app_1"
        artifactId="art_1"
        initial={INITIAL}
        onSaveNewVersion={vi.fn()}
        onRewriteBullet={vi.fn()}
      />,
    );
    const handles = screen.getAllByRole("button", { name: /Drag bullet/i });
    expect(handles).toHaveLength(2);
  });
});
