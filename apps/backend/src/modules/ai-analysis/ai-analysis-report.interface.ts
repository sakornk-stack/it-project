export interface AiSkillAnalysisReport {
  studentProfileId: string;
  // Not persisted (see TODO.md) — every response is freshly generated, so
  // callers can tell two responses apart even though nothing is cached.
  generatedAt: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

// How well the student's record supports a career, in words only: the AI never
// returns a number (§25), and the label is a hedge, not a verdict.
export type AiCareerFitLevel = 'STRONG' | 'GOOD' | 'WORTH_EXPLORING';

export interface AiCareerSuggestion {
  title: string;
  fit: AiCareerFitLevel;
  reason: string;
  // Codes of courses the student has passed, checked against the transcript
  // server-side: a code the model invents is dropped.
  supportingCourses: { code: string; name: string }[];
  skillsToBuild: string[];
}

export interface AiCareerSuggestionReport {
  studentProfileId: string;
  generatedAt: string;
  overview: string;
  careers: AiCareerSuggestion[];
}
