import { echoWorker } from "./echo-worker";
import { getWorker, registerWorker } from "./registry";

// Idempotent registration: HMR + repeat imports must not throw.
if (!getWorker(echoWorker.name)) {
  registerWorker(echoWorker);
}
