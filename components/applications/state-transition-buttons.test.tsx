// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ApplicationState } from "@prisma/client";

// Stub next/navigation — only useRouter is needed
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Stub the server action import so the client component compiles in jsdom
vi.mock("@/app/(authed)/applications/[id]/_actions", () => ({
  transitionApplicationAction: vi.fn(),
}));

// (transitions-table is pure data — no db import to mock)

import { StateTransitionButtons } from "./state-transition-buttons";
import { TRANSITIONS } from "@/lib/state-machine/transitions-table";

function buttonLabels() {
  const container = screen.queryByTestId("state-transition-buttons");
  if (!container) return [];
  return within(container)
    .queryAllByRole("button")
    .map((b) => b.textContent?.trim() ?? "");
}

describe("StateTransitionButtons", () => {
  it.each(Object.values(ApplicationState))(
    "renders exactly the valid next states for %s",
    (state) => {
      const expected = [...TRANSITIONS[state]];
      const { unmount } = render(
        <StateTransitionButtons applicationId="app-1" currentState={state} />,
      );
      expect(buttonLabels().sort()).toEqual(expected.map(String).sort());
      unmount();
    },
  );

  it("renders nothing for ARCHIVED (terminal)", () => {
    render(
      <StateTransitionButtons
        applicationId="app-1"
        currentState={ApplicationState.ARCHIVED}
      />,
    );
    expect(screen.queryByTestId("state-transition-buttons")).toBeNull();
  });

  it("offers SHORTLISTED + ARCHIVED from DISCOVERED", () => {
    render(
      <StateTransitionButtons
        applicationId="app-1"
        currentState={ApplicationState.DISCOVERED}
      />,
    );
    expect(buttonLabels().sort()).toEqual(
      [ApplicationState.SHORTLISTED, ApplicationState.ARCHIVED].sort(),
    );
  });
});
