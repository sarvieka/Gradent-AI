import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Filter, Calendar, AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import ContentHeader from '../components/layout/ContentHeader';
import { getHistory, formatUserError } from '../services/api';
import type { HistoryEntry } from '../types';

export function formatStudentFilename(filename: string | null | undefined): string {
  if (!filename || !filename.trim()) {
    return 'Student Answer';
  }
  const fname = filename.trim();
  if (/^tmp[a-z0-9_]+\.pdf$/i.test(fname) || fname.toLowerCase().startsWith('tmp')) {
    return 'Student Answer';
  }
  return fname;
}

export default function History() {
  const navigate = useNavigate();
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getHistory()
      .then((data) => {
        setHistoryItems(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load history:', err);
        setError(formatUserError(err));
        setLoading(false);
      });
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <ContentHeader title="Assessment Workbench" showSearch={true} />

        <div className="page-content" style={{ maxWidth: 1100 }}>
          <h1 className="page-title" style={{ textAlign: 'left' }}>Grading History</h1>
          <p className="page-subtitle" style={{ textAlign: 'left' }}>
            Review and manage previous submissions.
          </p>

          <div className="history-container">
            <div className="history-toolbar">
              <div className="history-toolbar-left">
                <button className="history-filter-btn">
                  <Filter size={14} />
                  Filter
                </button>
                <button className="history-filter-btn">
                  <Calendar size={14} />
                  Date Range
                </button>
              </div>
              <span className="history-count">
                Showing {historyItems.length} result{historyItems.length === 1 ? '' : 's'}
              </span>
            </div>

            {loading ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
                <Loader2 size={32} className="spin" style={{ marginBottom: 12, color: 'var(--color-primary)' }} />
                <div>Loading submissions history…</div>
                <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : error ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-incorrect)' }}>
                {error}
              </div>
            ) : historyItems.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
                <FileText size={40} style={{ opacity: 0.4, marginBottom: 12 }} />
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>No Submissions Found</div>
                <div style={{ fontSize: 13 }}>Grade student answer papers to view history records here.</div>
              </div>
            ) : (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Student Answer</th>
                    <th>Score</th>
                    <th>Confidence</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((item) => {
                    const confidenceVal = item.confidence ?? 1.0;
                    const confidencePct = Math.round(confidenceVal * 100);
                    const isFlagged = item.status === 'flagged' || item.flagged_for_human_review;
                    const isCompleted = item.status === 'completed' || item.status === 'reviewed';

                    return (
                      <tr key={item.submission_id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{item.created_at}</td>
                        <td>
                          <div className="history-filename">
                            <FileText size={16} className="history-filename-icon" />
                            <span>{formatStudentFilename(item.student_pdf_filename)}</span>
                          </div>
                        </td>
                        <td>
                          <span className="history-score">
                            {item.total_score}/{item.max_score}
                          </span>
                        </td>
                        <td>
                          <div className="history-confidence">
                            <div className="history-confidence-bar">
                              <div
                                className="history-confidence-fill"
                                style={{
                                  width: `${confidencePct}%`,
                                  background:
                                    confidencePct > 80
                                      ? 'var(--color-primary)'
                                      : confidencePct > 60
                                      ? 'var(--color-partial)'
                                      : 'var(--color-incorrect)',
                                }}
                              />
                            </div>
                            <span>{confidencePct}%</span>
                          </div>
                        </td>
                        <td>
                          {isCompleted ? (
                            <span className="history-status reviewed">
                              <CheckCircle2 size={12} />
                              Reviewed
                            </span>
                          ) : isFlagged ? (
                            <span className="history-status flagged">
                              <AlertTriangle size={12} />
                              Review recommended
                            </span>
                          ) : item.total_score === 0 ? (
                            <span className="history-status blank">
                              <Info size={12} />
                              No content detected
                            </span>
                          ) : (
                            <span className="history-status reviewed">
                              <CheckCircle2 size={12} />
                              Reviewed
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className={`history-action-btn ${isFlagged && !isCompleted ? 'review' : ''}`}
                            onClick={() => navigate(`/review/${item.submission_id}`)}
                          >
                            {isFlagged && !isCompleted ? 'Review Now' : 'View Result'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
