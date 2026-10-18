// Normalized shape GoogleStrategy.validate() attaches to request.user —
// deliberately minimal, distinct from RequestUser (which represents an
// authenticated EduAnalyzeAI account, not a raw external identity).
export interface GoogleProfile {
  email: string;
  googleId: string;
  fullName: string;
  // Google's email_verified claim. Sign-in is refused without it.
  emailVerified: boolean;
  // Workspace `hd` claim (absent for consumer Gmail accounts).
  hostedDomain?: string;
}
