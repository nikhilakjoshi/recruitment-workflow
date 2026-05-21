import { applicationCreatorWorker } from "./application-creator";
import { echoWorker } from "./echo-worker";
import { matchScorerWorker } from "./match-scorer";
import { getWorker, registerWorker } from "./registry";

// Idempotent registration: HMR + repeat imports must not throw.
function registerOnce(worker: Parameters<typeof registerWorker>[0]) {
  if (!getWorker(worker.name)) registerWorker(worker);
}

registerOnce(applicationCreatorWorker);
registerOnce(echoWorker);
registerOnce(matchScorerWorker);

export { applicationCreatorWorker, echoWorker, matchScorerWorker };
