import type { EventType } from "@prisma/client";
import type { ScheduledWorker, Worker } from "./types";

const registry = new Map<string, Worker>();
const scheduledRegistry = new Map<string, ScheduledWorker>();

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

export function registerScheduledWorker(worker: ScheduledWorker): void {
  if (scheduledRegistry.has(worker.name)) {
    throw new Error(`Scheduled worker '${worker.name}' is already registered`);
  }
  scheduledRegistry.set(worker.name, worker);
}

export function getScheduledWorker(name: string): ScheduledWorker | undefined {
  return scheduledRegistry.get(name);
}

export function listScheduledWorkers(): ScheduledWorker[] {
  return Array.from(scheduledRegistry.values());
}

export function _resetRegistryForTests(): void {
  registry.clear();
  scheduledRegistry.clear();
}
