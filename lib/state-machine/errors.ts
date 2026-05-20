import type { ApplicationState } from "@prisma/client";

export class InvalidTransitionError extends Error {
  readonly from: ApplicationState;
  readonly to: ApplicationState;

  constructor(from: ApplicationState, to: ApplicationState) {
    super(`Invalid application state transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
    this.from = from;
    this.to = to;
  }
}
