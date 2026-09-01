import { Quote, Lightbulb, Sparkles } from 'lucide-react';
import type { CriterionResult } from '../../types';

interface Props {
  criteria: CriterionResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  correct: 'Correct',
  partial: 'Partially Correct',
  incorrect: 'Incorrect',
  missing: 'Missing',
  unclear: 'Unclear',
};

export default function CriteriaList({ criteria, selectedId, onSelect }: Props) {
  return (
    <div className="criteria-list">
      {criteria.map((c, i) => (
        <div
          key={c.rubric_item_id}
          className={`criterion-card ${selectedId === c.rubric_item_id ? 'selected' : ''}`}
          onClick={() => onSelect(c.rubric_item_id)}
        >
          <div className="criterion-header">
            <span className="criterion-title">Question 1 — Criterion {i + 1}</span>
            <span className="criterion-marks">{c.awarded_marks} / {c.max_marks}</span>
          </div>

          <span className={`criterion-status ${c.status}`}>
            {STATUS_LABELS[c.status] || c.status}
          </span>

          {c.evidence_block_ids.length > 0 && (
            <div className="criterion-evidence">
              <Quote size={14} className="criterion-evidence-icon" />
              <span>"{c.explanation.substring(0, 80)}…"</span>
            </div>
          )}

          {c.feedback && c.status !== 'correct' && (
            <div className="criterion-feedback explanation">
              <Lightbulb size={14} className="criterion-feedback-icon" />
              <span>{c.feedback}</span>
            </div>
          )}

          {c.correction && (
            <div className="criterion-feedback correction" style={{ marginTop: 6 }}>
              <Sparkles size={14} className="criterion-feedback-icon" />
              <span>Correction: {c.correction}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
