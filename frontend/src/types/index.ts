/* ─────────────────────────────────────────────
   GradeMaster AI — Shared types
   ───────────────────────────────────────────── */

export type CriterionStatus = 'correct' | 'partial' | 'incorrect' | 'missing' | 'unclear';

export interface TextBlock {
  id: string;
  page: number;
  text: string;
  bbox: [number, number, number, number];
  confidence?: number;
}

export interface CriterionResult {
  rubric_item_id: string;
  criterion_description: string;
  status: CriterionStatus;
  awarded_marks: number;
  max_marks: number;
  evidence_block_ids: string[];
  explanation: string;
  feedback: string;
  correction: string;
  confidence: number;
}

export interface Annotation {
  id: string;
  submission_id: string;
  page: number;
  bbox: [number, number, number, number];
  annotation_type: string;
  feedback_text: string;
  is_user_edited: boolean;
}

export interface GradingResult {
  submission_id: string;
  total_score: number;
  max_score: number;
  criteria: CriterionResult[];
  overall_feedback: string;
  overall_confidence: number;
  flagged_for_human_review: boolean;
  review_reasons: string[];
  status: string;
  annotations: Annotation[];
  text_blocks?: TextBlock[];
}

export interface HistoryEntry {
  submission_id: string;
  student_pdf_filename: string;
  total_score: number;
  max_score: number;
  confidence: number;
  status: string;
  flagged_for_human_review: boolean;
  created_at: string;
}

export type UploadedFile = {
  file: File;
  name: string;
  size: number;
};

export type ProgressStage = {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress?: number;
};
