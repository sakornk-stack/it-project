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
