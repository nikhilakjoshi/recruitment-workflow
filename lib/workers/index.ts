import { applicationApprovedFinalizerWorker } from "./application-approved-finalizer";
import { applicationCreatorWorker } from "./application-creator";
import { companyResearchAssistantWorker } from "./company-research-assistant";
import { coverLetterGeneratorWorker } from "./cover-letter-generator";
import { echoWorker } from "./echo-worker";
import { interviewPrepAssistantWorker } from "./interview-prep-assistant";
import { linkedinOptimizerWorker } from "./linkedin-optimizer";
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
registerOnce(companyResearchAssistantWorker);
registerOnce(interviewPrepAssistantWorker);
registerOnce(linkedinOptimizerWorker);

export {
  applicationApprovedFinalizerWorker,
  applicationCreatorWorker,
  companyResearchAssistantWorker,
  coverLetterGeneratorWorker,
  echoWorker,
  interviewPrepAssistantWorker,
  linkedinOptimizerWorker,
  matchScorerWorker,
  tailoredResumeBuilderWorker,
};
