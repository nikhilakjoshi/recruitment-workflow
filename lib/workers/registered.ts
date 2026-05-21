import { echoWorker } from "./echo-worker";
import { applicationCreatorWorker } from "./application-creator";
import { getWorker, registerWorker } from "./registry";

// Idempotent registration: HMR + repeat imports must not throw.
if (!getWorker(echoWorker.name)) {
  registerWorker(echoWorker);
}
if (!getWorker(applicationCreatorWorker.name)) {
  registerWorker(applicationCreatorWorker);
}
