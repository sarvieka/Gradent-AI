import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  CheckCircle2,
  AlertTriangle,
  Maximize2,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import ContentHeader from '../components/layout/ContentHeader';
import GroupedCriteriaList from '../components/grading/GroupedCriteriaList';
import StructuredFeedback from '../components/grading/StructuredFeedback';
import VerticalPdfViewer from '../components/pdf/VerticalPdfViewer';
import QuotaErrorCard from '../components/common/QuotaErrorCard';
import { getGradingResult, isQuotaError, formatUserError } from '../services/api';
import type { GradingResult } from '../types';

export default function GradingReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [result, setResult] = useState<GradingResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState<boolean>(false);

  const [selectedCriterionId, setSelectedCriterionId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(100);
  const [showExportToast, setShowExportToast] = useState(false);
  const [showCompleteToast, setShowCompleteToast] = useState(false);

  const loadGradingResult = useCallback(() => {
    if (!id) {
      setError('No submission ID provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setIsQuotaExhausted(false);

    getGradingResult(id)
      .then((data) => {
        setResult(data);
        if (data.criteria.length > 0) {
          setSelectedCriterionId(data.criteria[0].rubric_item_id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Fetch grading result error:', err);
        setLoading(false);
        if (isQuotaError(err)) {
          setIsQuotaExhausted(true);
        } else {
          setError(formatUserError(err));
        }
      });
  }, [id]);

  useEffect(() => {
    loadGradingResult();
  }, [loadGradingResult]);

  const handlePageCountLoaded = useCallback((count: number) => {
    setTotalPages(count);
  }, []);

  const scrollToPage = (pageNum: number) => {
    const targetEl = document.getElementById(`pdf-page-${pageNum}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSelectCriterion = (criterionId: string) => {
    setSelectedCriterionId(criterionId);

    setTimeout(() => {
      const el = document.getElementById(`criterion-${criterionId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 50);
  };

  const handleSelectEvidence = (criterionId: string, page: number, blockId: string) => {
    setSelectedCriterionId(criterionId);

    setTimeout(() => {
      const targetEl =
        document.getElementById(`highlight-${criterionId}-${blockId}`) ||
        document.getElementById(`pdf-page-${page}`);

      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  const handleExport = async () => {
    if (!id) return;
    setShowExportToast(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/grading/${id}/export`, { method: 'POST' });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `annotated_submission_${id.substring(0, 8)}.pdf`;
        a.click();
      }
    } catch {
      // Export feedback
    } finally {
      setTimeout(() => setShowExportToast(false), 3000);
    }
  };

  const handleComplete = () => {
    setShowCompleteToast(true);
    setTimeout(() => setShowCompleteToast(false), 3000);
  };

  if (loading) {
    return (
      <div className="app-layout">
        <Sidebar />
        <div className="app-main">
          <ContentHeader title="Assessment Workbench" showSearch={false} />
          <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <Loader2 size={36} className="spin" style={{ color: 'var(--color-primary)', marginBottom: 16 }} />
            <h2 style={{ fontSize: 18, color: 'var(--color-text)' }}>Loading Grading Results…</h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Fetching original student PDF and AI evaluation…</p>
            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      </div>
    );
  }

  if (isQuotaExhausted) {
    return (
      <div className="app-layout">
        <Sidebar />
        <div className="app-main">
          <ContentHeader title="Assessment Workbench" showSearch={false} />
          <div className="page-content" style={{ maxWidth: 680, marginTop: 48 }}>
            <QuotaErrorCard onRetry={loadGradingResult} isRetrying={loading} />
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => navigate('/')} style={{ width: 'auto', display: 'inline-flex' }}>
                Go Back to New Grading
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="app-layout">
        <Sidebar />
        <div className="app-main">
          <ContentHeader title="Assessment Workbench" showSearch={false} />
          <div className="page-content" style={{ maxWidth: 600, marginTop: 48 }}>
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 32,
              textAlign: 'center',
              boxShadow: 'var(--shadow-md)',
            }}>
              <AlertCircle size={48} style={{ color: 'var(--color-incorrect)', marginBottom: 16 }} />
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Grading Unavailable</h2>
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 24 }}>
                {error || 'Submission could not be evaluated.'}
              </p>
              <button className="btn-primary" onClick={() => navigate('/')}>
                Go Back to New Grading
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const confidencePercent = Math.round((result.overall_confidence || 1.0) * 100);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <ContentHeader title="Assessment Workbench" showSearch={true} />

        <div className="review-layout">
          {/* CENTER: Continuous Vertical Student PDF Viewer */}
          <div className="pdf-viewer">
            <div className="pdf-toolbar">
              <span className="pdf-toolbar-filename">
                Submission ID: {result.submission_id.substring(0, 8)}… (Original Student Answer PDF — {totalPages} Pages)
              </span>

              {/* Page Scroll Jump Controls */}
              <div className="pdf-toolbar-nav">
                <button
                  className="pdf-toolbar-btn"
                  onClick={() => scrollToPage(Math.max(1, activePage - 1))}
                  disabled={activePage <= 1}
                  aria-label="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>
                <span>Page {activePage} of {totalPages}</span>
                <button
                  className="pdf-toolbar-btn"
                  onClick={() => scrollToPage(Math.min(totalPages, activePage + 1))}
                  disabled={activePage >= totalPages}
                  aria-label="Next Page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="pdf-toolbar-separator" />

              {/* Zoom Controls */}
              <div className="pdf-toolbar-nav">
                <button
                  className="pdf-toolbar-btn"
                  onClick={() => setZoom((z) => Math.max(50, z - 10))}
                  aria-label="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="pdf-toolbar-zoom">{zoom}%</span>
                <button
                  className="pdf-toolbar-btn"
                  onClick={() => setZoom((z) => Math.min(200, z + 10))}
                  aria-label="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
              </div>

              <div className="pdf-toolbar-separator" />

              <button
                className="pdf-fitwidth-btn"
                onClick={() => setZoom(100)}
              >
                <Maximize2 size={12} style={{ marginRight: 4 }} />
                Fit to Width
              </button>
            </div>

            {/* Vertical Continuous Scroll Area */}
            <VerticalPdfViewer
              submissionId={result.submission_id}
              zoom={zoom}
              criteria={result.criteria}
              textBlocks={result.text_blocks || []}
              selectedCriterionId={selectedCriterionId}
              onSelectCriterion={handleSelectCriterion}
              onPageCountLoaded={handlePageCountLoaded}
              onActivePageChange={setActivePage}
            />
          </div>

          {/* RIGHT: Grading Panel */}
          <div className="grading-panel">
            <div className="grading-panel-header">
              <div className="grading-score-row">
                <div className="grading-score">
                  {result.total_score} <span>/ {result.max_score}</span>
                </div>
                <div className={`grading-status-badge ${result.flagged_for_human_review ? 'flagged' : 'completed'}`}>
                  {result.flagged_for_human_review ? (
                    <>
                      <AlertTriangle size={14} />
                      Review Recommended
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      AI Grading Complete
                    </>
                  )}
                </div>
              </div>
              <div className="grading-score-label">Total Score</div>

              <div className="grading-confidence">
                <div className="confidence-bar-track">
                  <div
                    className={`confidence-bar-fill ${confidencePercent > 80 ? 'high' : confidencePercent > 60 ? 'medium' : 'low'}`}
                    style={{ width: `${confidencePercent}%` }}
                  />
                </div>
                <span className="confidence-label">
                  {confidencePercent}% Confidence
                </span>
              </div>
            </div>

            {/* Structured Overall Feedback */}
            <div style={{ padding: 12 }}>
              <StructuredFeedback
                feedbackText={result.overall_feedback}
                totalScore={result.total_score}
                maxScore={result.max_score}
                confidence={result.overall_confidence}
              />

              {/* Criteria Grouped by Question 1 (Science), Question 2 (English), Question 3 (Economics) */}
              <GroupedCriteriaList
                criteria={result.criteria}
                textBlocks={result.text_blocks || []}
                selectedCriterionId={selectedCriterionId}
                onSelectCriterion={handleSelectCriterion}
                onSelectEvidence={handleSelectEvidence}
              />
            </div>

            <div className="grading-panel-actions">
              <button className="btn-primary" onClick={handleComplete} style={{ width: '100%' }}>
                <CheckCircle2 size={16} />
                Complete Review
              </button>
              <button className="btn-secondary" onClick={handleExport}>
                <Download size={16} />
                Export Annotated PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {showExportToast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'var(--color-primary)',
          color: 'white',
          padding: '12px 20px',
          borderRadius: 8,
          boxShadow: 'var(--shadow-lg)',
          fontSize: 14,
          fontWeight: 500,
          zIndex: 1000,
        }}>
          Generating & downloading annotated PDF…
        </div>
      )}

      {showCompleteToast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'var(--color-correct)',
          color: 'white',
          padding: '12px 20px',
          borderRadius: 8,
          boxShadow: 'var(--shadow-lg)',
          fontSize: 14,
          fontWeight: 500,
          zIndex: 1000,
        }}>
          Review marked as complete!
        </div>
      )}
    </div>
  );
}
