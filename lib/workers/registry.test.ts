import { afterEach, describe, expect, it } from "vitest";
import { EventType } from "@prisma/client";
import {
  _resetRegistryForTests,
  getWorker,
  listWorkers,
  registerWorker,
  workersForEvent,
} from "./registry";
import type { Worker } from "./types";

function makeWorker(name: string, subscribes: EventType[]): Worker {
  return {
    name,
    scope: "always-on",
    model: "cheap",
    subscribes,
    async run() {
      return { output: null };
    },
  };
}

afterEach(() => {
  _resetRegistryForTests();
});

describe("worker registry", () => {
  it("registers and retrieves a worker by name", () => {
    const w = makeWorker("alpha", [EventType.JOB_DISCOVERED]);
    registerWorker(w);
    expect(getWorker("alpha")).toBe(w);
    expect(listWorkers()).toHaveLength(1);
  });

  it("throws on duplicate name", () => {
    registerWorker(makeWorker("dup", []));
    expect(() => registerWorker(makeWorker("dup", []))).toThrowError(/already registered/);
  });

  it("workersForEvent returns only subscribers of that event type", () => {
    const a = makeWorker("a", [EventType.JOB_DISCOVERED]);
    const b = makeWorker("b", [EventType.RESUME_APPROVED]);
    const c = makeWorker("c", [EventType.JOB_DISCOVERED, EventType.RESUME_APPROVED]);
    registerWorker(a);
    registerWorker(b);
    registerWorker(c);

    const subs = workersForEvent(EventType.JOB_DISCOVERED);
    expect(subs.map((w) => w.name).sort()).toEqual(["a", "c"]);
  });

  it("workersForEvent skips workers with no subscriptions", () => {
    registerWorker({
      name: "scheduled-only",
      scope: "always-on",
      model: "cheap",
      schedule: "0 9 * * *",
      async run() {
        return { output: null };
      },
    });
    expect(workersForEvent(EventType.JOB_DISCOVERED)).toHaveLength(0);
  });
});
