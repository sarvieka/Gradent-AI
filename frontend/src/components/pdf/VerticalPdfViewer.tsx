import { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, Plus, X } from 'lucide-react';
import type { CriterionResult, TextBlock, Annotation } from '../../types';
import { updateAnnotation, deleteAnnotation, createAnnotation } from '../../services/api';

interface Props {
  submissionId: string;
  zoom: number;
  criteria: CriterionResult[];
  textBlocks: TextBlock[];
  annotations: Annotation[];
  initialTotalPages?: number;
  selectedCriterionId: string | null;
  addAnnotationMode?: boolean;
  onSelectCriterion: (criterionId: string) => void;
  onPageCountLoaded: (count: number) => void;
  onActivePageChange: (activePage: number) => void;
  onAnnotationCreate: (annotation: Annotation) => void;
  onAnnotationUpdate: (annotation: Annotation) => void;
  onAnnotationDelete: (annotationId: string) => void;
  onAddAnnotationModeEnd?: () => void;
}

interface PageMeta {
  pageNum: number;
  width: number;
  height: number;
  imageUrl: string;
}

interface PopoverData {
  id: string;
  targetElementId: string;
  title: string;
  status: string;
  score: string;
  feedback: string;
  correction?: string;
  annotationType: string;
  pageNum: number;
  isTeacher?: boolean;
  annotationId?: string;
}

interface ContextMenuData {
  x: number;
  y: number;
  annotationId?: string;
  aiCriterionId?: string;
  aiBlock?: TextBlock;
  aiCriterion?: CriterionResult;
  isTeacher?: boolean;
  pageNum?: number;
  clickXFrac?: number;
  clickYFrac?: number;
  pageMeta?: PageMeta;
}

interface EditModalData {
  annotationId?: string;
  aiCriterionId?: string;
  aiBlock?: TextBlock;
  feedbackText: string;
  annotationType: string;
  pageNum?: number;
}

const STATUS_CONFIG: Record<string, { accent: string; bg: string; bgSelected: string; label: string }> = {
  correct:   { accent: '#16a34a', bg: 'rgba(34,197,94,0.06)',   bgSelected: 'rgba(34,197,94,0.16)',   label: 'Correct' },
  partial:   { accent: '#ea580c', bg: 'rgba(234,88,12,0.06)',  bgSelected: 'rgba(234,88,12,0.16)',  label: 'Partially Correct' },
  incorrect: { accent: '#dc2626', bg: 'rgba(220,38,38,0.06)',   bgSelected: 'rgba(220,38,38,0.16)',   label: 'Incorrect' },
  missing:   { accent: '#64748b', bg: 'rgba(100,116,139,0.06)', bgSelected: 'rgba(100,116,139,0.16)', label: 'Missing' },
  unclear:   { accent: '#7c3aed', bg: 'rgba(124,58,237,0.06)',  bgSelected: 'rgba(124,58,237,0.16)',  label: 'Unclear' },
  comment:   { accent: '#2563eb', bg: 'rgba(37,99,235,0.06)',   bgSelected: 'rgba(37,99,235,0.16)',   label: 'Comment' },
};

function getStatusConfig(type: string) {
  return STATUS_CONFIG[type] || STATUS_CONFIG['comment'];
}

/** Human-readable short title for tooltips & popovers */
function getCriterionConciseTitle(criterion: CriterionResult) {
  const desc = criterion.criterion_description;
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
  return desc.split(/[-–:]/)[0].substring(0, 32);
}

/** Smart collision-aware popover position calculator */
function calculatePopoverPosition(
  targetEl: HTMLElement,
  containerEl: HTMLElement,
  popoverWidth = 280,
  popoverHeight = 180
) {
  const targetRect = targetEl.getBoundingClientRect();
  const containerRect = containerEl.getBoundingClientRect();

  const padding = 12;

  const spaceRight = containerRect.right - targetRect.right - padding;
  const spaceLeft = targetRect.left - containerRect.left - padding;
  const spaceAbove = targetRect.top - containerRect.top - padding;

  let left = 0;
  let top = 0;

  // Option 1: Prefer Right of target region
  if (spaceRight >= popoverWidth) {
    left = targetRect.right + 10;
    top = targetRect.top;
  }
  // Option 2: Position Left of target region
  else if (spaceLeft >= popoverWidth) {
    left = targetRect.left - popoverWidth - 10;
    top = targetRect.top;
  }
  // Option 3: Position Above target region
  else if (spaceAbove >= popoverHeight) {
    left = targetRect.left;
    top = targetRect.top - popoverHeight - 10;
  }
  // Option 4: Position Below target region
  else {
    left = targetRect.left;
    top = targetRect.bottom + 10;
  }

  // Strict clamping to container viewport bounds
  left = Math.max(containerRect.left + padding, Math.min(containerRect.right - popoverWidth - padding, left));
  top = Math.max(containerRect.top + padding, Math.min(containerRect.bottom - popoverHeight - padding, top));

  const isOutOfView =
    targetRect.bottom < containerRect.top + 10 ||
    targetRect.top > containerRect.bottom - 10;

  return { left, top, isOutOfView };
}

export default function VerticalPdfViewer({
  submissionId,
  zoom,
  criteria,
  textBlocks,
  annotations,
  initialTotalPages,
  selectedCriterionId,
  onSelectCriterion,
  onPageCountLoaded,
  onActivePageChange,
  onAnnotationCreate,
  onAnnotationUpdate,
  onAnnotationDelete,
}: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<PageMeta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Deleted AI highlight IDs (hidden in UI)
  const [deletedAiHighlightIds, setDeletedAiHighlightIds] = useState<Set<string>>(new Set());

  // Active Left-Click Popover & Popover Position
  const [activePopover, setActivePopover] = useState<PopoverData | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ left: number; top: number } | null>(null);

  // Right-Click Context Menu
  const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);

  // Edit Modal Data
  const [editModal, setEditModal] = useState<EditModalData | null>(null);

  // Delete Confirmation Modal
  const [pendingDelete, setPendingDelete] = useState<{ annotationId?: string; aiHighlightId?: string } | null>(null);

  // Add Annotation Modal Data
  const [addModal, setAddModal] = useState<{
    page: number;
    bbox: [number, number, number, number];
    feedbackText: string;
    annotationType: string;
  } | null>(null);

  // Close popovers & context menu on global click outside
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Update Popover Position dynamically on activePopover change, scroll, or window resize
  useEffect(() => {
    if (!activePopover?.targetElementId || !scrollContainerRef.current) {
      setPopoverPos(null);
      return;
    }

    const updatePos = () => {
      const targetEl = document.getElementById(activePopover.targetElementId);
      const containerEl = scrollContainerRef.current;
      if (!targetEl || !containerEl) return;

      const pos = calculatePopoverPosition(targetEl, containerEl);
      if (pos.isOutOfView) {
        setPopoverPos(null);
      } else {
        setPopoverPos({ left: pos.left, top: pos.top });
      }
    };

    updatePos();

    const containerEl = scrollContainerRef.current;
    containerEl.addEventListener('scroll', updatePos);
    window.addEventListener('resize', updatePos);

    return () => {
      containerEl.removeEventListener('scroll', updatePos);
      window.removeEventListener('resize', updatePos);
    };
  }, [activePopover, zoom]);

  // Keep stable ref for onPageCountLoaded to prevent re-triggering fetchAllPages
  const onPageCountLoadedRef = useRef(onPageCountLoaded);
  useEffect(() => {
    onPageCountLoadedRef.current = onPageCountLoaded;
  }, [onPageCountLoaded]);

  // Load all pages of the original student PDF ONCE per submissionId
  useEffect(() => {
    setLoading(true);
    setError(null);

    const fetchAllPages = async () => {
      try {
        const res1 = await fetch(`http://127.0.0.1:8000/api/grading/${submissionId}/page/1`);
        if (!res1.ok) throw new Error('Failed to load student PDF');

        const totalPagesHeader = res1.headers.get('X-Total-Pages');
        const headerCount = totalPagesHeader ? parseInt(totalPagesHeader, 10) : 0;
        const maxBlockPage = textBlocks.length > 0 ? Math.max(...textBlocks.map((b) => b.page)) : 0;
        const total = Math.max(headerCount, maxBlockPage, initialTotalPages || 1, 1);
        onPageCountLoadedRef.current(total);

        const pagePromises = Array.from({ length: total }, async (_, i) => {
          const p = i + 1;
          const res = p === 1 ? res1 : await fetch(`http://127.0.0.1:8000/api/grading/${submissionId}/page/${p}`);
          const wHeader = res.headers.get('X-Page-Width');
          const hHeader = res.headers.get('X-Page-Height');
          const blob = await res.blob();
          const imageUrl = URL.createObjectURL(blob);

          return {
            pageNum: p,
            width: wHeader ? parseFloat(wHeader) : 595.28,
            height: hHeader ? parseFloat(hHeader) : 841.89,
            imageUrl,
          };
        });

        const loadedPages = await Promise.all(pagePromises);
        setPages(loadedPages);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to render PDF document');
        setLoading(false);
      }
    };

    fetchAllPages();
  }, [submissionId, initialTotalPages]);

  // Track active visible page while scrolling page
  useEffect(() => {
    const handlePageTracking = () => {
      if (!scrollContainerRef.current) return;
      const pageEls = scrollContainerRef.current.querySelectorAll('.pdf-page-container');
      if (pageEls.length === 0) return;

      let currentActive = 1;
      const middle = window.innerHeight / 2;

      pageEls.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        if (rect.top <= middle && rect.bottom >= 80) {
          currentActive = index + 1;
        }
      });

      // Special case: if scrolled to the very bottom of the viewport/document
      const isAtBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 60);
      if (isAtBottom && pageEls.length > 0) {
        currentActive = pageEls.length;
      }

      onActivePageChange(currentActive);
    };

    window.addEventListener('scroll', handlePageTracking, { passive: true });
    handlePageTracking();
    return () => window.removeEventListener('scroll', handlePageTracking);
  }, [pages.length, onActivePageChange]);

  const blockMap = new Map<string, TextBlock>(textBlocks.map((b) => [b.id, b]));

  // Save new teacher annotation
  const handleSaveAddModal = async () => {
    if (!addModal) return;
    try {
      const saved = await createAnnotation(submissionId, {
        page: addModal.page,
        bbox: addModal.bbox,
        annotation_type: addModal.annotationType,
        feedback_text: addModal.feedbackText,
      });
      onAnnotationCreate(saved);
      setAddModal(null);
    } catch (err) {
      console.error('Failed to save annotation:', err);
    }
  };

  // Save annotation edit
  const handleSaveEditModal = async () => {
    if (!editModal) return;
    try {
      if (editModal.annotationId) {
        const updated = await updateAnnotation(editModal.annotationId, {
          feedback_text: editModal.feedbackText,
          annotation_type: editModal.annotationType,
        });
        onAnnotationUpdate(updated);
      } else if (editModal.aiBlock && editModal.pageNum) {
        const created = await createAnnotation(submissionId, {
          page: editModal.pageNum,
          bbox: editModal.aiBlock.bbox,
          annotation_type: editModal.annotationType,
          feedback_text: editModal.feedbackText,
        });
        onAnnotationCreate(created);
      }
      setEditModal(null);
    } catch (err) {
      console.error('Failed to update annotation:', err);
    }
  };

  // Confirm delete handler
  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.annotationId) {
        await deleteAnnotation(pendingDelete.annotationId);
        onAnnotationDelete(pendingDelete.annotationId);
      } else if (pendingDelete.aiHighlightId) {
        setDeletedAiHighlightIds((prev) => new Set(prev).add(pendingDelete.aiHighlightId!));
      }
      setActivePopover(null);
      setPendingDelete(null);
    } catch (err) {
      console.error('Failed to delete annotation:', err);
    }
  };

  // Hit-testing right-click context menu handler on PDF page
  const handlePageContextMenu = (e: React.MouseEvent, pageMeta: PageMeta, aiHighlightsOnPage: any[]) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const clickXFrac = (e.clientX - rect.left) / rect.width;
    const clickYFrac = (e.clientY - rect.top) / rect.height;

    const pdfX = clickXFrac * pageMeta.width;
    const pdfY = clickYFrac * pageMeta.height;

    // 1. Check if click hits any DB Annotation on this page
    const pageDbAnnotations = annotations.filter((ann) => ann.page === pageMeta.pageNum);
    const hitDbAnn = pageDbAnnotations.find(
      (ann) =>
        pdfX >= ann.bbox[0] &&
        pdfX <= ann.bbox[2] &&
        pdfY >= ann.bbox[1] &&
        pdfY <= ann.bbox[3]
    );

    if (hitDbAnn) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        annotationId: hitDbAnn.id,
        isTeacher: true,
      });
      return;
    }

    // 2. Check if click hits any AI Highlight on this page
    const hitAi = aiHighlightsOnPage.find(
      (hl) =>
        pdfX >= hl.block.bbox[0] &&
        pdfX <= hl.block.bbox[2] &&
        pdfY >= hl.block.bbox[1] &&
        pdfY <= hl.block.bbox[3]
    );

    if (hitAi) {
      const existingDbAnn = annotations.find(
        (ann) =>
          ann.page === pageMeta.pageNum &&
          Math.abs(ann.bbox[0] - hitAi.block.bbox[0]) < 3 &&
          Math.abs(ann.bbox[1] - hitAi.block.bbox[1]) < 3
      );

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        annotationId: existingDbAnn?.id,
        aiCriterionId: hitAi.criterionId,
        aiBlock: hitAi.block,
        aiCriterion: hitAi.criterion,
        pageNum: pageMeta.pageNum,
        isTeacher: true,
      });
      return;
    }

    // 3. Otherwise empty PDF area -> "Add Annotation Here"
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      pageNum: pageMeta.pageNum,
      clickXFrac,
      clickYFrac,
      pageMeta,
    });
  };

  return (
    <div
      ref={scrollContainerRef}
      onClick={() => setActivePopover(null)}
      style={{
        width: '100%',
        padding: '24px 16px 40px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
        background: '#f1f5f9',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {loading && (
        <div style={{ padding: 60, color: '#64748b', fontSize: 14, textAlign: 'center' }}>
          Rendering Student Answer Paper…
        </div>
      )}

      {error && (
        <div style={{ padding: 60, color: 'var(--color-incorrect)', fontSize: 14, textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* --- FLOATING COLLISION-AWARE ANNOTATION POPOVER --- */}
      {activePopover && popoverPos && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: popoverPos.top,
            left: popoverPos.left,
            width: 264,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: '10px 12px',
            boxShadow: '0 4px 16px -4px rgba(0,0,0,0.12)',
            zIndex: 1000,
            cursor: 'default',
            fontFamily: "'Geist Sans', 'Inter', sans-serif",
          }}
        >
          {/* Header row: status badge + score */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: getStatusConfig(activePopover.annotationType).accent,
              background: getStatusConfig(activePopover.annotationType).bg,
              padding: '2px 7px',
              borderRadius: 3,
            }}>
              {getStatusConfig(activePopover.annotationType).label}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {activePopover.score && (
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
                  {activePopover.score}
                </span>
              )}
              <button
                onClick={() => setActivePopover(null)}
                title="Close"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 2, background: 'none', border: 'none', cursor: 'pointer',
                  color: '#94a3b8', borderRadius: 3,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
              >
                <X size={12} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Teacher Note label */}
          <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 3 }}>
            Teacher Note
          </div>

          {/* Title */}
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: activePopover.feedback ? 4 : 0, lineHeight: 1.4 }}>
            {activePopover.title}
          </div>

          {/* Feedback */}
          {activePopover.feedback && (
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: activePopover.correction ? 6 : 0 }}>
              {activePopover.feedback}
            </div>
          )}

          {/* Correction block */}
          {activePopover.correction && (
            <div style={{
              fontSize: 11,
              color: '#059669',
              background: '#f0fdf4',
              padding: '5px 8px',
              borderRadius: 4,
              borderLeft: '2px solid #34d399',
              marginTop: 4,
              lineHeight: 1.4,
            }}>
              <strong style={{ fontWeight: 600 }}>Correction:</strong> {activePopover.correction}
            </div>
          )}

          {/* Action row */}
          {activePopover.isTeacher && activePopover.annotationId && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              borderTop: '1px solid #f1f5f9',
              paddingTop: 8,
              marginTop: 8,
            }}>
              <button
                onClick={() => {
                  setEditModal({
                    annotationId: activePopover.annotationId,
                    feedbackText: activePopover.feedback,
                    annotationType: activePopover.annotationType,
                  });
                  setActivePopover(null);
                }}
                title="Edit annotation"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 500,
                  color: '#3b82f6',
                  background: 'none', border: '1px solid transparent',
                  borderRadius: 4, padding: '3px 8px',
                  cursor: 'pointer', transition: 'all 120ms ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#eff6ff'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#bfdbfe'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}
              >
                <Pencil size={11} strokeWidth={2} />
                Edit
              </button>
              <button
                onClick={() => {
                  setPendingDelete({ annotationId: activePopover.annotationId });
                  setActivePopover(null);
                }}
                title="Delete annotation"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 500,
                  color: '#ef4444',
                  background: 'none', border: '1px solid transparent',
                  borderRadius: 4, padding: '3px 8px',
                  cursor: 'pointer', transition: 'all 120ms ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#fecaca'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}
              >
                <Trash2 size={11} strokeWidth={2} />
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- RIGHT-CLICK CONTEXT MENU --- */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: Math.min(window.innerHeight - 100, contextMenu.y),
            left: Math.min(window.innerWidth - 180, contextMenu.x),
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
            zIndex: 1000,
            padding: '4px 0',
            minWidth: 160,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.annotationId || contextMenu.aiCriterionId ? (
            <>
              <button
                onClick={() => {
                  if (contextMenu.annotationId) {
                    const targetAnn = annotations.find((a) => a.id === contextMenu.annotationId);
                    setEditModal({
                      annotationId: contextMenu.annotationId,
                      feedbackText: targetAnn?.feedback_text || '',
                      annotationType: targetAnn?.annotation_type || 'incorrect',
                    });
                  } else if (contextMenu.aiCriterion && contextMenu.aiBlock) {
                    setEditModal({
                      aiCriterionId: contextMenu.aiCriterionId,
                      aiBlock: contextMenu.aiBlock,
                      feedbackText: contextMenu.aiCriterion.explanation || contextMenu.aiCriterion.feedback || '',
                      annotationType: contextMenu.aiCriterion.status,
                      pageNum: contextMenu.pageNum,
                    });
                  }
                  setContextMenu(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 14px',
                  background: 'none',
                  border: 'none',
                  fontSize: 13,
                  color: '#1e293b',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <Pencil size={13} strokeWidth={1.75} style={{ marginRight: 7, flexShrink: 0 }} />
                Edit Annotation
              </button>
              <button
                onClick={() => {
                  setPendingDelete({
                    annotationId: contextMenu.annotationId,
                    aiHighlightId: contextMenu.aiBlock ? `hl_${contextMenu.aiCriterionId}_${contextMenu.aiBlock.id}` : undefined,
                  });
                  setContextMenu(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 14px',
                  background: 'none',
                  border: 'none',
                  fontSize: 13,
                  color: '#dc2626',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <Trash2 size={13} strokeWidth={1.75} style={{ marginRight: 7, flexShrink: 0 }} />
                Delete Annotation
              </button>
            </>
          ) : contextMenu.pageMeta ? (
            <button
              onClick={() => {
                const pm = contextMenu.pageMeta!;
                const x0 = contextMenu.clickXFrac! * pm.width;
                const y0 = contextMenu.clickYFrac! * pm.height;
                const x1 = Math.min(pm.width, x0 + 180);
                const y1 = Math.min(pm.height, y0 + 40);

                setAddModal({
                  page: contextMenu.pageNum!,
                  bbox: [x0, y0, x1, y1],
                  feedbackText: '',
                  annotationType: 'comment',
                });
                setContextMenu(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                textAlign: 'left',
                padding: '7px 14px',
                background: 'none',
                border: 'none',
                fontSize: 13,
                color: '#1e293b',
                cursor: 'pointer',
                fontWeight: 500,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <Plus size={13} strokeWidth={1.75} style={{ marginRight: 7, flexShrink: 0 }} />
              Add Annotation Here
            </button>
          ) : null}
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {pendingDelete && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: 24,
            width: 360,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>
              Delete Annotation?
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              This will remove the annotation from the PDF viewer. The AI grading score will remain unchanged.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setPendingDelete(null)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT ANNOTATION MODAL --- */}
      {editModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: 24,
            width: 420,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#0f172a' }}>
              Edit Annotation
            </h3>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Status / Category
            </label>
            <select
              value={editModal.annotationType}
              onChange={(e) => setEditModal((m) => m ? { ...m, annotationType: e.target.value } : m)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: 14, fontSize: 13 }}
            >
              <option value="comment">Teacher Comment</option>
              <option value="partial">Partially Correct</option>
              <option value="incorrect">Incorrect</option>
            </select>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Feedback / Notes
            </label>
            <textarea
              value={editModal.feedbackText}
              onChange={(e) => setEditModal((m) => m ? { ...m, feedbackText: e.target.value } : m)}
              style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, minHeight: 90, boxSizing: 'border-box', marginBottom: 18 }}
            />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditModal(null)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditModal}
                style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Save Annotation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD ANNOTATION MODAL --- */}
      {addModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: 24,
            width: 420,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#0f172a' }}>
              Add Teacher Annotation (Page {addModal.page})
            </h3>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Status / Category
            </label>
            <select
              value={addModal.annotationType}
              onChange={(e) => setAddModal((m) => m ? { ...m, annotationType: e.target.value } : m)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: 14, fontSize: 13 }}
            >
              <option value="comment">Teacher Comment</option>
              <option value="partial">Partially Correct</option>
              <option value="incorrect">Incorrect</option>
            </select>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Feedback / Comment
            </label>
            <textarea
              placeholder="Type your comment or correction for this section…"
              value={addModal.feedbackText}
              onChange={(e) => setAddModal((m) => m ? { ...m, feedbackText: e.target.value } : m)}
              style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, minHeight: 90, boxSizing: 'border-box', marginBottom: 18 }}
            />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setAddModal(null)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAddModal}
                style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Create Annotation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- RENDER PDF PAGES --- */}
      {!loading &&
        pages.map((pageMeta) => {
          const scaledWidth = Math.round(pageMeta.width * (zoom / 100));
          const scaledHeight = Math.round(pageMeta.height * (zoom / 100));

          // ─── AI ANNOTATIONS: ONLY NON-CORRECT ANSWERS (partial & incorrect ONLY) ───
          const aiHighlights: Array<{
            id: string;
            criterionId: string;
            criterion: CriterionResult;
            block: TextBlock;
          }> = [];

          criteria.forEach((c) => {
            if (c.status === 'correct' || c.status === 'missing') {
              return;
            }

            (c.evidence_block_ids || []).forEach((blockId) => {
              const block = blockMap.get(blockId);
              const hlId = `hl_${c.rubric_item_id}_${blockId}`;
              if (block && block.page === pageMeta.pageNum && !deletedAiHighlightIds.has(hlId)) {
                aiHighlights.push({
                  id: hlId,
                  criterionId: c.rubric_item_id,
                  criterion: c,
                  block,
                });
              }
            });
          });

          // ─── REAL DB ANNOTATIONS (Same objects exported to PDF) ───
          const pageDbAnnotations = annotations.filter((ann) => ann.page === pageMeta.pageNum);

          return (
            <div
              key={pageMeta.pageNum}
              id={`pdf-page-${pageMeta.pageNum}`}
              className="pdf-page-container"
              style={{
                width: scaledWidth,
                height: scaledHeight,
                position: 'relative',
                background: '#ffffff',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
                borderRadius: 2,
                flexShrink: 0,
                transition: 'width 150ms ease, height 150ms ease',
              }}
              onContextMenu={(e) => handlePageContextMenu(e, pageMeta, aiHighlights)}
            >
              {/* PDF Page Image */}
              <img
                src={pageMeta.imageUrl}
                alt={`Student Answer PDF Page ${pageMeta.pageNum}`}
                style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
                draggable={false}
              />

              {/* Watermark Page Indicator */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 12,
                  right: 16,
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#64748b',
                  background: 'rgba(255, 255, 255, 0.92)',
                  padding: '3px 10px',
                  borderRadius: 4,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              >
                Page {pageMeta.pageNum} of {pages.length}
              </div>

              {/* ─── AI EVIDENCE HIGHLIGHT OVERLAYS (SUBTLE) ─── */}
              {aiHighlights.map((hl) => {
                const [x0, y0, x1, y1] = hl.block.bbox;
                const leftPct = (x0 / pageMeta.width) * 100;
                const topPct = (y0 / pageMeta.height) * 100;
                const widthPct = ((x1 - x0) / pageMeta.width) * 100;
                const heightPct = ((y1 - y0) / pageMeta.height) * 100;

                const isSelected = selectedCriterionId === hl.criterionId;
                const cfg = getStatusConfig(hl.criterion.status);
                const title = getCriterionConciseTitle(hl.criterion);

                const isDiagram =
                  y1 - y0 > 65 ||
                  hl.block.text.toLowerCase().includes('diagram') ||
                  hl.block.text.toLowerCase().includes('graph') ||
                  hl.block.text.includes('Price') ||
                  hl.block.text.includes('Battery');

                const targetElId = `highlight-${hl.criterionId}-${hl.block.id}`;
                const existingDbAnn = annotations.find(
                  (ann) =>
                    ann.page === pageMeta.pageNum &&
                    Math.abs(ann.bbox[0] - hl.block.bbox[0]) < 3 &&
                    Math.abs(ann.bbox[1] - hl.block.bbox[1]) < 3
                );

                return (
                  <div
                    key={hl.id}
                    id={targetElId}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCriterion(hl.criterionId);

                      // Open clean Popover on Left-Click with targetElementId
                      setActivePopover({
                        id: hl.id,
                        targetElementId: targetElId,
                        title,
                        status: cfg.label,
                        score: `${hl.criterion.awarded_marks} / ${hl.criterion.max_marks} Marks`,
                        feedback: hl.criterion.explanation || hl.criterion.feedback || '',
                        correction: hl.criterion.correction,
                        annotationType: hl.criterion.status,
                        pageNum: pageMeta.pageNum,
                      });
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        annotationId: existingDbAnn?.id,
                        aiCriterionId: hl.criterionId,
                        aiBlock: hl.block,
                        aiCriterion: hl.criterion,
                        pageNum: pageMeta.pageNum,
                        isTeacher: true,
                      });
                    }}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                      backgroundColor: isDiagram ? 'transparent' : isSelected ? cfg.bgSelected : cfg.bg,
                      borderBottom: isDiagram ? 'none' : `1.5px solid ${cfg.accent}`,
                      border: isDiagram ? `1.5px dashed ${cfg.accent}` : undefined,
                      borderRadius: 2,
                      cursor: 'pointer',
                      boxShadow: isSelected ? `0 0 0 2px ${cfg.accent}` : 'none',
                      zIndex: isSelected ? 15 : 5,
                      transition: 'all 150ms ease',
                    }}
                  />
                );
              })}

              {/* ─── REAL PERSISTED DB ANNOTATIONS (EXPORTED TO PDF) ─── */}
              {pageDbAnnotations.map((ann) => {
                const leftPct = (ann.bbox[0] / pageMeta.width) * 100;
                const topPct = (ann.bbox[1] / pageMeta.height) * 100;
                const widthPct = ((ann.bbox[2] - ann.bbox[0]) / pageMeta.width) * 100;
                const heightPct = ((ann.bbox[3] - ann.bbox[1]) / pageMeta.height) * 100;

                const cfg = getStatusConfig(ann.annotation_type);
                const targetElId = `teacher-ann-${ann.id}`;

                return (
                  <div
                    key={ann.id}
                    id={targetElId}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePopover({
                        id: `teacher_${ann.id}`,
                        targetElementId: targetElId,
                        title: 'Teacher Annotation',
                        status: cfg.label,
                        score: 'Teacher Note',
                        feedback: ann.feedback_text,
                        annotationType: ann.annotation_type,
                        pageNum: pageMeta.pageNum,
                        isTeacher: true,
                        annotationId: ann.id,
                      });
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        annotationId: ann.id,
                        isTeacher: true,
                      });
                    }}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                      backgroundColor: cfg.bg,
                      border: `1.5px solid ${cfg.accent}`,
                      borderRadius: 3,
                      cursor: 'pointer',
                      zIndex: 10,
                      transition: 'all 150ms ease',
                    }}
                  >
                    {/* Teacher marker icon */}
                    <span style={{
                      position: 'absolute',
                      top: -8, left: -4,
                      background: cfg.accent,
                      color: '#fff',
                      fontSize: 9,
                      padding: '1px 4px',
                      borderRadius: 3,
                      fontWeight: 700,
                    }}>
                      ✎
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
    </div>
  );
}
