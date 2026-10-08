export interface ValidationRule {
  id: string;
  description: string;
  failureMessage: string;
  validate: (code: string) => boolean;
}

export interface Exercise {
  id: string;
  title: string;
  description: string;
  preamble: string; // Read-only code shown before learner's editor
  starterCode: string; // Initial editable code
  postscript: string; // Read-only code shown after learner's editor
  hints: string[];
  solution: string;
  rules: ValidationRule[];
}

export interface ValidationResult {
  ruleId: string;
  passed: boolean;
  message: string;
}
