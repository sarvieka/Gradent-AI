import { CheckCircle2, TrendingUp, Sparkles, Award } from 'lucide-react';

interface Props {
  feedbackText: string;
  totalScore: number;
  maxScore: number;
  confidence: number;
}

/** Clean raw markdown symbols, section numbers, and headers */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*[^*]+\*\*/g, (match) => match.replace(/\*\*/g, '')) // Remove **bold**
    .replace(/\*/g, '')
    .replace(/#/g, '')
    .replace(/`/g, '')
    .replace(/^\d+\.\s*/gm, '') // Remove leading "1. ", "2. "
    .trim();
}

/** Parse overall feedback string into structured clean sections */
function parseStructuredSections(rawText: string) {
  const clean = stripMarkdown(rawText);

  // Split into sentences
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/^(?:Science|English|Economics|\(Q\d\)|Q\d):?\s*/i, '').trim())
    .filter((s) => s.length > 5);

  const strengths: string[] = [];
  const improvements: string[] = [];
  const general: string[] = [];

  sentences.forEach((s) => {
    const lower = s.toLowerCase();
    if (
      lower.includes('strong') ||
      lower.includes('great') ||
      lower.includes('correctly') ||
      lower.includes('excellent') ||
      lower.includes('good') ||
      lower.includes('well')
    ) {
      if (!strengths.includes(s)) strengths.push(s);
    } else if (
      lower.includes('improve') ||
      lower.includes('remember') ||
      lower.includes('pay attention') ||
      lower.includes('lacks') ||
      lower.includes('error') ||
      lower.includes('incorrect') ||
      lower.includes('attention')
    ) {
      if (!improvements.includes(s)) improvements.push(s);
    } else {
      if (!general.includes(s)) general.push(s);
    }
  });

  return {
    performanceSummary:
      general.length > 0
        ? general.join(' ')
        : 'Overall evaluation completed based on marking rubric criteria.',
    strengths: strengths.slice(0, 4),
    improvements: improvements.slice(0, 4),
  };
}

export default function StructuredFeedback({
  feedbackText,
  totalScore,
  maxScore,
  confidence,
}: Props) {
  const { performanceSummary, strengths, improvements } = parseStructuredSections(feedbackText);
  const confidencePct = Math.round(confidence * 100);

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 20,
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Award size={20} style={{ color: 'var(--color-primary)' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Overall Evaluation</h3>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          Confidence: <span style={{ color: 'var(--color-primary)' }}>{confidencePct}%</span>
        </div>
      </div>

      {/* 1. Overall Performance */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          Overall Performance
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6 }}>
          {performanceSummary}
        </p>
      </div>

      {/* 2. Score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--color-bg)', borderRadius: 'var(--radius)', marginBottom: 14 }}>
        <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Score Awarded</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
            {totalScore} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>/ {maxScore} Marks</span>
          </div>
        </div>
      </div>

      {/* 3. What You Did Well */}
      {strengths.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-correct)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={14} /> What You Did Well
          </div>
          <ul style={{ paddingLeft: 18, fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6 }}>
            {strengths.map((st, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{st}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 4. Areas for Improvement */}
      {improvements.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-partial)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <TrendingUp size={14} /> Areas for Improvement
          </div>
          <ul style={{ paddingLeft: 18, fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6 }}>
            {improvements.map((imp, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{imp}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
