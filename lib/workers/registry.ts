import type { EventType } from "@prisma/client";
import type { Worker } from "./types";

const registry = new Map<string, Worker>();

export function registerWorker(worker: Worker): void {
  if (registry.has(worker.name)) {
    throw new Error(`Worker '${worker.name}' is already registered`);
  }
  registry.set(worker.name, worker);
}

export function getWorker(name: string): Worker | undefined {
  return registry.get(name);
}

export function listWorkers(): Worker[] {
  return Array.from(registry.values());
}

export function workersForEvent(type: EventType): Worker[] {
  return listWorkers().filter((w) => w.subscribes?.includes(type));
}

export function _resetRegistryForTests(): void {
  registry.clear();
}
