import { useNavigate } from 'react-router-dom';
import { FileText, Filter, Calendar, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import ContentHeader from '../components/layout/ContentHeader';
import { MOCK_HISTORY } from '../data/mockData';

export default function History() {
  const navigate = useNavigate();

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
              <span className="history-count">Showing 3 of 124 results</span>
            </div>

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
                {MOCK_HISTORY.map((item) => (
                  <tr key={item.submission_id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{item.created_at}</td>
                    <td>
                      <div className="history-filename">
                        <FileText size={16} className="history-filename-icon" />
                        <span>{item.student_pdf_filename}</span>
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
                              width: `${Math.round(item.confidence * 100)}%`,
                              background:
                                item.confidence > 0.8
                                  ? 'var(--color-primary)'
                                  : item.confidence > 0.6
                                  ? 'var(--color-partial)'
                                  : 'var(--color-incorrect)',
                            }}
                          />
                        </div>
                        <span>{Math.round(item.confidence * 100)}%</span>
                      </div>
                    </td>
                    <td>
                      {item.status === 'flagged' ? (
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
                        className={`history-action-btn ${
                          item.status === 'flagged' ? 'review' : ''
                        }`}
                        onClick={() => navigate('/review')}
                      >
                        {item.status === 'flagged' ? 'Review Now' : 'View Result'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="history-pagination">
              <button className="nav-btn" disabled>
                <ChevronLeft size={16} />
              </button>
              <button className="active">1</button>
              <button>2</button>
              <button>3</button>
              <span>…</span>
              <button className="nav-btn">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
