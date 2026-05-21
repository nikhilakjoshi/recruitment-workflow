import { EventType } from "@prisma/client";
import { EMPTY_SCOPE, type Worker } from "./types";

export type EchoOutput = {
  echoedEventId: string;
  echoedPayload: unknown;
};

export const echoWorker: Worker<unknown, EchoOutput> = {
  name: "echo",
  runtime: "always-on",
  scope: EMPTY_SCOPE,
  model: "cheap",
  subscribes: [EventType.JOB_DISCOVERED],
  async run(ctx) {
    const output: EchoOutput = {
      echoedEventId: ctx.event.id,
      echoedPayload: ctx.event.payloadJson,
    };
    if (process.env.NODE_ENV !== "production") {
      console.log(`[echo] ${ctx.event.id}`);
    }
    return { output };
  },
};
