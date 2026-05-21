import { afterEach, describe, expect, it } from "vitest";
import { EventType } from "@prisma/client";
import {
  _resetRegistryForTests,
  getScheduledWorker,
  getWorker,
  listScheduledWorkers,
  listWorkers,
  registerScheduledWorker,
  registerWorker,
  workersForEvent,
} from "./registry";
import { EMPTY_SCOPE, type ScheduledWorker, type Worker } from "./types";

function makeWorker(name: string, subscribes: EventType[]): Worker {
  return {
    name,
    runtime: "always-on",
    scope: EMPTY_SCOPE,
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
      runtime: "always-on",
      scope: EMPTY_SCOPE,
      model: "cheap",
      schedule: "0 9 * * *",
      async run() {
        return { output: null };
      },
    });
    expect(workersForEvent(EventType.JOB_DISCOVERED)).toHaveLength(0);
  });
});

function makeScheduledWorker(name: string, schedule: string): ScheduledWorker {
  return {
    name,
    schedule,
    runtime: "always-on",
    model: "cheap",
    async run() {
      return { output: null };
    },
  };
}

describe("scheduled worker registry", () => {
  it("registers and retrieves a scheduled worker by name", () => {
    const w = makeScheduledWorker("daily-tick", "0 8 * * *");
    registerScheduledWorker(w);
    expect(getScheduledWorker("daily-tick")).toBe(w);
    expect(listScheduledWorkers()).toHaveLength(1);
  });

  it("throws on duplicate scheduled worker name", () => {
    registerScheduledWorker(makeScheduledWorker("dup-s", "0 8 * * *"));
    expect(() =>
      registerScheduledWorker(makeScheduledWorker("dup-s", "0 8 * * *")),
    ).toThrowError(/already registered/);
  });

  it("keeps event-driven and scheduled registries separate", () => {
    registerWorker({
      name: "shared-name",
      runtime: "always-on",
      scope: EMPTY_SCOPE,
      model: "cheap",
      subscribes: [EventType.JOB_DISCOVERED],
      async run() {
        return { output: null };
      },
    });
    registerScheduledWorker(makeScheduledWorker("shared-name", "0 8 * * *"));
    expect(getWorker("shared-name")?.subscribes).toEqual([EventType.JOB_DISCOVERED]);
    expect(getScheduledWorker("shared-name")?.schedule).toBe("0 8 * * *");
  });
});
