import { applicationApprovedFinalizerWorker } from "./application-approved-finalizer";
import { applicationCreatorWorker } from "./application-creator";
import { coverLetterGeneratorWorker } from "./cover-letter-generator";
import { echoWorker } from "./echo-worker";
import { matchScorerWorker } from "./match-scorer";
import { tailoredResumeBuilderWorker } from "./tailored-resume-builder";
import { getWorker, registerWorker } from "./registry";

// Idempotent registration: HMR + repeat imports must not throw.
function registerOnce(worker: Parameters<typeof registerWorker>[0]) {
  if (!getWorker(worker.name)) registerWorker(worker);
}

registerOnce(applicationCreatorWorker);
registerOnce(echoWorker);
registerOnce(matchScorerWorker);
registerOnce(tailoredResumeBuilderWorker);
registerOnce(coverLetterGeneratorWorker);
registerOnce(applicationApprovedFinalizerWorker);

export {
  applicationApprovedFinalizerWorker,
  applicationCreatorWorker,
  coverLetterGeneratorWorker,
  echoWorker,
  matchScorerWorker,
  tailoredResumeBuilderWorker,
};
