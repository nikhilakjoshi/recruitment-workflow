import { applicationApprovedFinalizerWorker } from "./application-approved-finalizer";
import { applicationCreatorWorker } from "./application-creator";
import { applicationTrackerWorker } from "./application-tracker";
import { coverLetterGeneratorWorker } from "./cover-letter-generator";
import { echoWorker } from "./echo-worker";
import { jobAlertAggregatorWorker } from "./job-alert-aggregator";
import { matchScorerWorker } from "./match-scorer";
import { tailoredResumeBuilderWorker } from "./tailored-resume-builder";
import { weeklyDigestWorker } from "./weekly-digest";
import {
  getScheduledWorker,
  getWorker,
  registerScheduledWorker,
  registerWorker,
} from "./registry";

// Idempotent registration: HMR + repeat imports must not throw.
function registerOnce(worker: Parameters<typeof registerWorker>[0]) {
  if (!getWorker(worker.name)) registerWorker(worker);
}

function registerScheduledOnce(worker: Parameters<typeof registerScheduledWorker>[0]) {
  if (!getScheduledWorker(worker.name)) registerScheduledWorker(worker);
}

registerOnce(applicationCreatorWorker);
registerOnce(echoWorker);
registerOnce(matchScorerWorker);
registerOnce(tailoredResumeBuilderWorker);
registerOnce(coverLetterGeneratorWorker);
registerOnce(applicationApprovedFinalizerWorker);

registerScheduledOnce(jobAlertAggregatorWorker);
registerScheduledOnce(applicationTrackerWorker);
registerScheduledOnce(weeklyDigestWorker);

export {
  applicationApprovedFinalizerWorker,
  applicationCreatorWorker,
  applicationTrackerWorker,
  coverLetterGeneratorWorker,
  echoWorker,
  jobAlertAggregatorWorker,
  matchScorerWorker,
  tailoredResumeBuilderWorker,
  weeklyDigestWorker,
};
