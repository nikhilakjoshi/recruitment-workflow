import { renderToBuffer } from "@react-pdf/renderer";
import type { TailoredResume } from "@/lib/schemas/tailored-resume";
import type { CoverLetter } from "@/lib/schemas/cover-letter";
import { ResumeDocument } from "./templates/resume";
import { CoverLetterDocument } from "./templates/cover-letter";

export async function renderResumeToPDF(resume: TailoredResume): Promise<Buffer> {
  return renderToBuffer(<ResumeDocument resume={resume} />);
}

export async function renderCoverLetterToPDF(letter: CoverLetter): Promise<Buffer> {
  return renderToBuffer(<CoverLetterDocument letter={letter} />);
}
