import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  FileText,
} from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import ContentHeader from '../components/layout/ContentHeader';
import GroupedCriteriaList from '../components/grading/GroupedCriteriaList';
import StructuredFeedback from '../components/grading/StructuredFeedback';
import VerticalPdfViewer from '../components/pdf/VerticalPdfViewer';
import QuotaErrorCard from '../components/common/QuotaErrorCard';
import { getGradingResult, completeReview, isQuotaError, formatUserError } from '../services/api';
import type { GradingResult, Annotation } from '../types';
import { formatStudentFilename } from './History';

export default function GradingReview() {
  const { id: paramId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const id = paramId || (location.state as any)?.submissionId;

  const [result, setResult] = useState<GradingResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState<boolean>(false);

  // Live annotation state (synced with backend)
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  const [selectedCriterionId, setSelectedCriterionId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(100);
  const [showExportToast, setShowExportToast] = useState(false);
  const [showCompleteToast, setShowCompleteToast] = useState(false);
  const [addAnnotationMode, setAddAnnotationMode] = useState(false);

  // Collapsible Right Evaluation Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const scrollToPage = (pageNum: number) => {
    setActivePage(pageNum);
    const pageEl = document.getElementById(`pdf-page-${pageNum}`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const loadResult = useCallback(async () => {
    if (!id) {
      setError('No submission ID provided');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setIsQuotaExhausted(false);
    try {
      const res = await getGradingResult(id);
      setResult(res);
      setAnnotations(res.annotations || []);
      if (res.total_pages) {
        setTotalPages(res.total_pages);
      }
    } catch (err) {
      if (isQuotaError(err)) {
        setIsQuotaExhausted(true);
      } else {
        setError(formatUserError(err));
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadResult();
  }, [loadResult]);

  const handleSelectCriterion = (criterionId: string) => {
    setSelectedCriterionId(criterionId);
  };

  const handleSelectEvidence = (criterionId: string) => {
    setSelectedCriterionId(criterionId);
  };

  const handlePageCountLoaded = useCallback((count: number) => {
    setTotalPages((prev) => Math.max(prev, count));
  }, []);

  const handleAnnotationCreate = (newAnn: Annotation) => {
    setAnnotations((prev) => [...prev, newAnn]);
  };

  const handleAnnotationUpdate = (updatedAnn: Annotation) => {
    setAnnotations((prev) =>
      prev.map((ann) => (ann.id === updatedAnn.id ? updatedAnn : ann))
    );
  };

  const handleAnnotationDelete = (annotationId: string) => {
    setAnnotations((prev) => prev.filter((ann) => ann.id !== annotationId));
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

  const handleComplete = async () => {
    if (!id) return;
    try {
      const updated = await completeReview(id);
      setResult(updated);
      setShowCompleteToast(true);
      setTimeout(() => setShowCompleteToast(false), 3000);
    } catch (err) {
      console.error('Failed to complete review:', err);
    }
  };

  if (loading) {
    return (
      <div className="app-layout">
        <Sidebar />
        <div className="app-main">
          <ContentHeader title="Assessment Workbench" showSearch={false} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
            <Loader2 size={32} className="spin" style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Loading evaluation workbench...</span>
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
          <div className="page-content" style={{ maxWidth: 700, marginTop: 48 }}>
            <QuotaErrorCard onRetry={loadResult} />
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
          <div className="pdf-viewer" style={{ flex: 1 }}>
            {/* Single Compact Horizontal PDF Toolbar below Navbar */}
            <div className="pdf-toolbar">
              {/* Document Info: Label, Filename & Page Count */}
              <div className="pdf-toolbar-docinfo">
                <FileText size={15} className="pdf-toolbar-doc-icon" />
                <span className="pdf-toolbar-label">Student Answer</span>
                <span className="pdf-toolbar-dot">•</span>
                <span className="pdf-toolbar-filename" title={formatStudentFilename((result as any).student_pdf_filename || (result as any).filename)}>
                  {formatStudentFilename((result as any).student_pdf_filename || (result as any).filename)}
                </span>
                <span className="pdf-toolbar-page-badge">
                  {totalPages} {totalPages === 1 ? 'page' : 'pages'}
                </span>
              </div>

              <div className="pdf-toolbar-separator" />

              {/* Page Scroll Controls */}
              <div className="pdf-toolbar-nav">
                <button
                  className="pdf-toolbar-btn"
                  onClick={() => scrollToPage(Math.max(1, activePage - 1))}
                  disabled={activePage <= 1}
                  title="Previous Page"
                  aria-label="Previous Page"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="pdf-toolbar-page-text">
                  Page {activePage} of {totalPages}
                </span>
                <button
                  className="pdf-toolbar-btn"
                  onClick={() => scrollToPage(Math.min(totalPages, activePage + 1))}
                  disabled={activePage >= totalPages}
                  title="Next Page"
                  aria-label="Next Page"
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              <div className="pdf-toolbar-separator" />

              {/* Zoom Controls */}
              <div className="pdf-toolbar-nav">
                <button
                  className="pdf-toolbar-btn"
                  onClick={() => setZoom((z) => Math.max(50, z - 10))}
                  title="Zoom Out"
                  aria-label="Zoom Out"
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  className="pdf-toolbar-zoom-btn"
                  onClick={() => setZoom(100)}
                  title="Click to reset zoom to 100%"
                >
                  {zoom}%
                </button>
                <button
                  className="pdf-toolbar-btn"
                  onClick={() => setZoom((z) => Math.min(200, z + 10))}
                  title="Zoom In"
                  aria-label="Zoom In"
                >
                  <ZoomIn size={15} />
                </button>
              </div>

              <div className="pdf-toolbar-separator" style={{ marginLeft: 'auto' }} />

              {/* Collapsible Sidebar Toggle Button */}
              <button
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                className="pdf-toolbar-toggle-sidebar"
                title={isSidebarCollapsed ? 'Expand evaluation panel' : 'Collapse evaluation panel'}
              >
                {isSidebarCollapsed ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
                <span>{isSidebarCollapsed ? 'Show Evaluation' : 'Hide Evaluation'}</span>
              </button>
            </div>

            {/* Vertical Continuous Scroll Area */}
            <VerticalPdfViewer
              submissionId={result.submission_id}
              zoom={zoom}
              criteria={result.criteria}
              textBlocks={result.text_blocks || []}
              annotations={annotations}
              initialTotalPages={result.total_pages}
              selectedCriterionId={selectedCriterionId}
              addAnnotationMode={addAnnotationMode}
              onSelectCriterion={handleSelectCriterion}
              onPageCountLoaded={handlePageCountLoaded}
              onActivePageChange={setActivePage}
              onAnnotationCreate={handleAnnotationCreate}
              onAnnotationUpdate={handleAnnotationUpdate}
              onAnnotationDelete={handleAnnotationDelete}
              onAddAnnotationModeEnd={() => setAddAnnotationMode(false)}
            />
          </div>

          {/* RIGHT: Collapsible Grading Panel */}
          {!isSidebarCollapsed && (
            <div className="grading-panel" style={{ width: 380, flexShrink: 0 }}>
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
          )}
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
