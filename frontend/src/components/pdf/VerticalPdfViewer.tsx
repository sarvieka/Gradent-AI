import { useEffect, useRef, useState } from 'react';
import type { CriterionResult, TextBlock } from '../../types';

interface Props {
  submissionId: string;
  zoom: number;
  criteria: CriterionResult[];
  textBlocks: TextBlock[];
  selectedCriterionId: string | null;
  onSelectCriterion: (criterionId: string) => void;
  onPageCountLoaded: (count: number) => void;
  onActivePageChange: (activePage: number) => void;
}

interface PageMeta {
  pageNum: number;
  width: number;
  height: number;
  imageUrl: string;
}

/** Human-readable short title for tooltips */
function getCriterionTooltipInfo(criterion: CriterionResult) {
  const desc = criterion.criterion_description;
  let title = 'Criterion';
  if (desc.includes('circuit') || desc.includes('closed series')) title = 'Circuit Design';
  else if (desc.includes('ammeter') || desc.includes('voltmeter') || desc.includes('meter')) title = 'Meter Placement';
  else if (desc.includes('current flow') || desc.includes('components')) title = 'Current & Components';
  else if (desc.includes('resistance') || desc.includes('ohm')) title = 'Resistance & Current';
  else if (desc.includes('diagram') || desc.includes('labels')) title = 'Diagram & Labels';
  else if (desc.includes('position') || desc.includes('affects learning')) title = 'Position & Thesis';
  else if (desc.includes('arguments') || desc.includes('developed')) title = 'Supporting Arguments';
  else if (desc.includes('opposing') || desc.includes('limitation')) title = 'Counterargument';
  else if (desc.includes('examples') || desc.includes('reasoning')) title = 'Examples & Evidence';
  else if (desc.includes('conclusion') || desc.includes('communication')) title = 'Conclusion & Clarity';
  else if (desc.includes('plots') || desc.includes('graph') || desc.includes('demand and supply')) title = 'Demand & Supply Graph';
  else if (desc.includes('equilibrium')) title = 'Market Equilibrium';
  else if (desc.includes('shortage') || desc.includes('surplus')) title = 'Shortage / Surplus';
  else if (desc.includes('production cost') || desc.includes('shift')) title = 'Production Cost Shift';
  else if (desc.includes('tendency') || desc.includes('new equilibrium')) title = 'New Equilibrium';
  else title = desc.split(/[-–:]/)[0].substring(0, 30);

  return {
    title,
    score: `${criterion.awarded_marks} / ${criterion.max_marks}`,
    status: criterion.status.charAt(0).toUpperCase() + criterion.status.slice(1),
  };
}

export default function VerticalPdfViewer({
  submissionId,
  zoom,
  criteria,
  textBlocks,
  selectedCriterionId,
  onSelectCriterion,
  onPageCountLoaded,
  onActivePageChange,
}: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<PageMeta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredHighlightId, setHoveredHighlightId] = useState<string | null>(null);

  // Load all pages of the original student PDF
  useEffect(() => {
    setLoading(true);
    setError(null);

    const fetchAllPages = async () => {
      try {
        // Fetch Page 1 to determine total pages header
        const res1 = await fetch(`http://127.0.0.1:8000/api/grading/${submissionId}/page/1`);
        if (!res1.ok) throw new Error('Failed to load student PDF');

        const totalPagesHeader = res1.headers.get('X-Total-Pages');
        const total = totalPagesHeader ? parseInt(totalPagesHeader, 10) : 1;
        onPageCountLoaded(total);

        // Fetch page image blobs and dimensions for ALL pages concurrently
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
  }, [submissionId, onPageCountLoaded]);

  // Track active visible page while scrolling
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const pageEls = container.querySelectorAll('.pdf-page-container');

    let currentActive = 1;
    pageEls.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      if (rect.top <= containerRect.top + containerRect.height / 2) {
        currentActive = index + 1;
      }
    });

    onActivePageChange(currentActive);
  };

  const blockMap = new Map<string, TextBlock>(textBlocks.map((b) => [b.id, b]));

  let globalBadgeIndex = 0;

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      style={{
        width: '100%',
        height: 'calc(100vh - var(--header-height) - 44px)',
        overflowY: 'auto',
        padding: '32px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 32,
        background: '#e8e8e8',
        boxSizing: 'border-box',
      }}
    >
      {loading && (
        <div style={{ padding: 60, color: '#666', fontSize: 14, textAlign: 'center' }}>
          Rendering Original Student Answer PDF…
        </div>
      )}

      {error && (
        <div style={{ padding: 60, color: 'var(--color-incorrect)', fontSize: 14, textAlign: 'center' }}>
          {error}
        </div>
      )}

      {!loading &&
        pages.map((pageMeta) => {
          const scaledWidth = Math.round(pageMeta.width * (zoom / 100));
          const scaledHeight = Math.round(pageMeta.height * (zoom / 100));

          // Collect highlights on this page
          const pageHighlights: Array<{
            id: string;
            badgeNum: number;
            criterionId: string;
            criterion: CriterionResult;
            block: TextBlock;
          }> = [];

          criteria.forEach((c) => {
            (c.evidence_block_ids || []).forEach((blockId) => {
              const block = blockMap.get(blockId);
              if (block && block.page === pageMeta.pageNum) {
                globalBadgeIndex += 1;
                pageHighlights.push({
                  id: `hl_${c.rubric_item_id}_${blockId}`,
                  badgeNum: globalBadgeIndex,
                  criterionId: c.rubric_item_id,
                  criterion: c,
                  block,
                });
              }
            });
          });

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
                boxShadow: '0 6px 24px rgba(0, 0, 0, 0.15)',
                borderRadius: 2,
                flexShrink: 0,
                transition: 'width 150ms ease, height 150ms ease',
              }}
            >
              {/* PDF Page PNG Image */}
              <img
                src={pageMeta.imageUrl}
                alt={`Student Answer PDF Page ${pageMeta.pageNum}`}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />

              {/* Watermark Page Indicator */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 12,
                  right: 16,
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#666',
                  background: 'rgba(255, 255, 255, 0.9)',
                  padding: '3px 10px',
                  borderRadius: 4,
                  boxShadow: 'var(--shadow-sm)',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              >
                Page {pageMeta.pageNum} of {pages.length}
              </div>

              {/* Annotation Highlights for Page N */}
              {pageHighlights.map((hl) => {
                const [x0, y0, x1, y1] = hl.block.bbox;
                const leftPct = (x0 / pageMeta.width) * 100;
                const topPct = (y0 / pageMeta.height) * 100;
                const widthPct = ((x1 - x0) / pageMeta.width) * 100;
                const heightPct = ((y1 - y0) / pageMeta.height) * 100;

                const isSelected = selectedCriterionId === hl.criterionId;
                const isHovered = hoveredHighlightId === hl.id;
                const tooltip = getCriterionTooltipInfo(hl.criterion);

                // Detect if evidence block is a diagram, graph, or schedule (height > 65 points)
                const isDiagram =
                  y1 - y0 > 65 ||
                  hl.block.text.toLowerCase().includes('diagram') ||
                  hl.block.text.toLowerCase().includes('graph') ||
                  hl.block.text.includes('Price') ||
                  hl.block.text.includes('Battery');

                let accentColor = '#ea580c';
                let borderStyle = '2.5px solid #ea580c';
                let bgTint = isSelected || isHovered ? 'rgba(249, 115, 22, 0.16)' : 'rgba(249, 115, 22, 0.07)';

                if (hl.criterion.status === 'correct') {
                  accentColor = '#16a34a';
                  borderStyle = '2.5px solid #16a34a';
                  bgTint = isSelected || isHovered ? 'rgba(34, 197, 94, 0.16)' : 'rgba(34, 197, 94, 0.07)';
                } else if (hl.criterion.status === 'incorrect') {
                  accentColor = '#dc2626';
                  borderStyle = '2.5px solid #dc2626';
                  bgTint = isSelected || isHovered ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.07)';
                }

                return (
                  <div
                    key={hl.id}
                    id={`highlight-${hl.criterionId}-${hl.block.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCriterion(hl.criterionId);
                    }}
                    onMouseEnter={() => setHoveredHighlightId(hl.id)}
                    onMouseLeave={() => setHoveredHighlightId(null)}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                      backgroundColor: isDiagram ? 'transparent' : bgTint,
                      borderBottom: isDiagram ? 'none' : borderStyle,
                      border: isDiagram ? `1.5px dashed ${accentColor}` : undefined,
                      borderRadius: 3,
                      cursor: 'pointer',
                      boxShadow: isSelected ? `0 0 0 3px ${accentColor}, 0 4px 14px rgba(0,0,0,0.18)` : 'none',
                      zIndex: isSelected ? 15 : 5,
                      transition: 'all 150ms ease',
                    }}
                  >
                    {/* Numbered Badge Marker */}
                    <div
                      style={{
                        position: 'absolute',
                        top: -10,
                        right: -10,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: accentColor,
                        color: '#ffffff',
                        fontSize: 10,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-sm)',
                        zIndex: 20,
                      }}
                    >
                      {hl.badgeNum}
                    </div>

                    {/* Compact Hover Tooltip */}
                    {(isHovered || isSelected) && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: '50%',
                          transform: 'translateX(-50%) translateY(-6px)',
                          background: 'var(--color-primary)',
                          color: '#ffffff',
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          boxShadow: 'var(--shadow-md)',
                          zIndex: 30,
                          pointerEvents: 'none',
                        }}
                      >
                        <div>{tooltip.title} • {tooltip.score}</div>
                        <div style={{ fontSize: 10, opacity: 0.85, fontWeight: 500 }}>
                          Status: {tooltip.status}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
    </div>
  );
}
