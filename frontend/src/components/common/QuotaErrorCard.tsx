import { Clock, RefreshCw, FileCheck } from 'lucide-react';

interface Props {
  onRetry: () => void;
  isRetrying?: boolean;
}

export default function QuotaErrorCard({ onRetry, isRetrying = false }: Props) {
  return (
    <div
      style={{
        margin: '24px 0',
        padding: '28px 32px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius)',
            background: 'rgba(234, 88, 12, 0.1)',
            color: 'var(--color-partial)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Clock size={24} />
        </div>

        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>
            AI grading is temporarily unavailable
          </h3>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
            We've received your submission successfully, but the AI grading service has temporarily reached its usage limit.
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: 'var(--color-correct)',
              fontWeight: 500,
              background: 'rgba(34, 197, 94, 0.08)',
              padding: '8px 12px',
              borderRadius: 6,
              width: 'fit-content',
            }}
          >
            <FileCheck size={16} />
            <span>Your uploaded documents are safe. Please try again shortly.</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <button
          className="btn-primary"
          onClick={onRetry}
          disabled={isRetrying}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <RefreshCw size={16} className={isRetrying ? 'spin' : ''} />
          <span>{isRetrying ? 'Retrying Grading…' : 'Retry Grading'}</span>
        </button>

        <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
