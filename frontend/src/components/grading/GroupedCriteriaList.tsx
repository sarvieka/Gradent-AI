import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Quote, Lightbulb, Sparkles, AlertCircle } from 'lucide-react';
import type { CriterionResult, TextBlock } from '../../types';

interface QuestionGroup {
  id: string;
  title: string;
  awardedScore: number;
  maxScore: number;
  criteria: CriterionResult[];
}

interface Props {
  criteria: CriterionResult[];
  textBlocks: TextBlock[];
  selectedCriterionId: string | null;
  onSelectCriterion: (id: string) => void;
  onSelectEvidence: (criterionId: string, page: number, blockId: string) => void;
}

/** Human-readable short titles for criteria */
function getConciseTitle(criterion: CriterionResult, index: number): string {
  const desc = criterion.criterion_description.toLowerCase();

  if (desc.includes('circuit') || desc.includes('closed series')) return 'Circuit Design';
  if (desc.includes('ammeter') || desc.includes('voltmeter') || desc.includes('meter')) return 'Meter Placement';
  if (desc.includes('current flow') || desc.includes('components')) return 'Current & Components';
  if (desc.includes('resistance') || desc.includes('ohm')) return 'Resistance & Current';
  if (desc.includes('diagram') || desc.includes('labels')) return 'Diagram & Labels';

  if (desc.includes('position') || desc.includes('affects learning')) return 'Position & Thesis';
  if (desc.includes('arguments') || desc.includes('developed')) return 'Supporting Arguments';
  if (desc.includes('opposing') || desc.includes('limitation')) return 'Counterargument';
  if (desc.includes('examples') || desc.includes('reasoning')) return 'Examples & Evidence';
  if (desc.includes('conclusion') || desc.includes('communication')) return 'Conclusion & Clarity';

  if (desc.includes('plots') || desc.includes('graph') || desc.includes('demand and supply')) return 'Demand & Supply Graph';
  if (desc.includes('equilibrium')) return 'Market Equilibrium';
  if (desc.includes('shortage') || desc.includes('surplus')) return 'Shortage / Surplus';
  if (desc.includes('production cost') || desc.includes('shift')) return 'Production Cost Shift';
  if (desc.includes('tendency') || desc.includes('new equilibrium')) return 'New Equilibrium';

  const firstPhrase = criterion.criterion_description.split(/[-–:]/)[0].trim();
  return firstPhrase.length < 30 ? firstPhrase : `Criterion ${index + 1}`;
}

/** Group criteria into Question 1 (Science), Question 2 (English), Question 3 (Economics) */
function groupCriteria(criteria: CriterionResult[]): QuestionGroup[] {
  const groups: Record<string, QuestionGroup> = {};

  criteria.forEach((c) => {
    let qId = 'q1';
    let qTitle = 'Question 1 — Science';

    if (
      c.rubric_item_id.startsWith('q2') ||
      c.criterion_description.toLowerCase().includes('english') ||
      c.criterion_description.toLowerCase().includes('technology')
    ) {
      qId = 'q2';
      qTitle = 'Question 2 — English';
    } else if (
      c.rubric_item_id.startsWith('q3') ||
      c.criterion_description.toLowerCase().includes('economics') ||
      c.criterion_description.toLowerCase().includes('demand')
    ) {
      qId = 'q3';
      qTitle = 'Question 3 — Economics';
    }

    if (!groups[qId]) {
      groups[qId] = {
        id: qId,
        title: qTitle,
        awardedScore: 0,
        maxScore: 0,
        criteria: [],
      };
    }

    groups[qId].criteria.push(c);
    groups[qId].awardedScore += c.awarded_marks;
    groups[qId].maxScore += c.max_marks;
  });

  return Object.values(groups);
}

const STATUS_LABELS: Record<string, string> = {
  correct: 'Correct',
  partial: 'Partially Correct',
  incorrect: 'Incorrect',
  missing: 'Missing',
  unclear: 'Unclear',
};

const STATUS_COLORS: Record<string, string> = {
  correct: '#16a34a',
  partial: '#ea580c',
  incorrect: '#dc2626',
  missing: '#64748b',
  unclear: '#7c3aed',
};

export default function GroupedCriteriaList({
  criteria,
  textBlocks,
  selectedCriterionId,
  onSelectCriterion,
  onSelectEvidence,
}: Props) {
  const questionGroups = groupCriteria(criteria);
  // Default all question dropdowns to collapsed ({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const blockMap = new Map<string, TextBlock>(textBlocks.map((b) => [b.id, b]));

  // Auto-expand question group if teacher clicks a criterion or PDF annotation
  useEffect(() => {
    if (selectedCriterionId) {
      const targetGroup = questionGroups.find((g) =>
        g.criteria.some((c) => c.rubric_item_id === selectedCriterionId)
      );
      if (targetGroup) {
        setCollapsed((prev) => ({ ...prev, [targetGroup.id]: false }));
      }
    }
  }, [selectedCriterionId]);

  const toggleGroup = (groupId: string) => {
    setCollapsed((prev) => ({ ...prev, [groupId]: prev[groupId] === false ? true : false }));
  };

  return (
    <div className="criteria-list">
      {questionGroups.map((group) => {
        // Collapsed by default unless explicitly set to false
        const isCollapsed = collapsed[group.id] !== false;

        return (
          <div key={group.id} style={{ marginBottom: 16 }}>
            {/* Question Group Header */}
            <div
              onClick={() => toggleGroup(group.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
                color: 'var(--color-text)',
                marginBottom: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                <span>{group.title}</span>
              </div>
              <span style={{ fontSize: 13, color: 'var(--color-primary)' }}>
                {group.awardedScore} / {group.maxScore} Marks
              </span>
            </div>

            {/* Nested Criteria */}
            {!isCollapsed && (
              <div style={{ paddingLeft: 4 }}>
                {group.criteria.map((c, idx) => {
                  const isSelected = selectedCriterionId === c.rubric_item_id;
                  const title = getConciseTitle(c, idx);
                  const statusColor = STATUS_COLORS[c.status] || '#64748b';

                  // Map ALL evidence block IDs to actual student text blocks
                  const citedBlocks = (c.evidence_block_ids || [])
                    .map((bId) => blockMap.get(bId))
                    .filter((b): b is TextBlock => Boolean(b));

                  return (
                    <div
                      key={c.rubric_item_id}
                      id={`criterion-${c.rubric_item_id}`}
                      className={`criterion-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => onSelectCriterion(c.rubric_item_id)}
                      style={{ padding: 14, marginBottom: 8 }}
                    >
                      <div className="criterion-header">
                        <span className="criterion-title">{title}</span>
                        <span className="criterion-marks">
                          {c.awarded_marks} / {c.max_marks}
                        </span>
                      </div>

                      <span className={`criterion-status ${c.status}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>

                      {/* Description on selection */}
                      {isSelected && (
                        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8, marginTop: 6 }}>
                          {c.criterion_description}
                        </p>
                      )}

                      {/* Human-Readable Student Evidence — ALL blocks, each individually clickable */}
                      {citedBlocks.length > 0 ? (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                            Evidence from answer
                          </div>
                          {citedBlocks.map((block) => (
                            <div
                              key={block.id}
                              className="criterion-evidence"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectEvidence(c.rubric_item_id, block.page, block.id);
                              }}
                              style={{
                                cursor: 'pointer',
                                display: 'flex',
                                gap: 8,
                                padding: '7px 10px',
                                background: isSelected ? '#eef0f8' : 'var(--color-bg)',
                                borderRadius: 6,
                                marginBottom: 4,
                                borderLeft: `3px solid ${statusColor}`,
                                transition: 'background 150ms',
                              }}
                              title={`Click to locate evidence on student PDF (Page ${block.page})`}
                            >
                              <Quote size={13} style={{ flexShrink: 0, color: statusColor, marginTop: 2 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2, fontWeight: 600 }}>
                                  Page {block.page}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--color-text)', fontStyle: 'italic', wordBreak: 'break-word' }}>
                                  "{block.text.length > 120 ? block.text.substring(0, 120) + '…' : block.text}"
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="criterion-evidence" style={{ opacity: 0.7, padding: '6px 10px', marginTop: 6 }}>
                          <AlertCircle size={14} className="criterion-evidence-icon" />
                          <span style={{ fontSize: 12 }}>No direct evidence cited</span>
                        </div>
                      )}

                      {/* Feedback & explanation */}
                      {c.explanation && isSelected && (
                        <div className="criterion-feedback explanation" style={{ marginTop: 8 }}>
                          <Lightbulb size={14} className="criterion-feedback-icon" />
                          <span>{c.explanation}</span>
                        </div>
                      )}

                      {c.correction && isSelected && (
                        <div className="criterion-feedback correction" style={{ marginTop: 6 }}>
                          <Sparkles size={14} className="criterion-feedback-icon" />
                          <span>Correction: {c.correction}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
