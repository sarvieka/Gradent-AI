import { Check, CircleAlert, Loader2, RefreshCw, Zap } from 'lucide-react';
import type { ProgressStage } from '../../types';

interface Props {
  stages: ProgressStage[];
  onCancel: () => void;
}

function StageIcon({ status }: { status: ProgressStage['status'] }) {
  switch (status) {
    case 'completed':
      return <Check size={18} />;
    case 'active':
      return <Loader2 size={18} className="spin" />;
    case 'failed':
      return <CircleAlert size={18} />;
    default:
      return <RefreshCw size={16} />;
  }
}

export default function GradingProgressModal({ stages, onCancel }: Props) {
  return (
    <div className="progress-overlay">
      <div className="progress-modal">
        <div className="progress-modal-header">
          <div className="progress-modal-icon">
            <Zap size={22} />
          </div>
          <div>
            <div className="progress-modal-title">Grading in Progress</div>
            <div className="progress-modal-subtitle">Processing submission batch…</div>
          </div>
        </div>

        <div className="progress-stages">
          {stages.map((stage) => (
            <div key={stage.id} className={`progress-stage ${stage.status}`}>
              <div className="progress-stage-icon">
                <StageIcon status={stage.status} />
              </div>
              <div className="progress-stage-content">
                <div className="progress-stage-label">{stage.label}</div>
                <div className="progress-stage-desc">{stage.description}</div>
                {stage.status === 'active' && stage.progress !== undefined && (
                  <>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${stage.progress}%` }}
                      />
                    </div>
                    <div className="progress-bar-info">
                      <span>File {Math.round(stage.progress * 0.24)} of 24</span>
                      <span>{stage.progress}%</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <button className="progress-cancel-btn" onClick={onCancel}>
          Cancel Process
        </button>
      </div>

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
