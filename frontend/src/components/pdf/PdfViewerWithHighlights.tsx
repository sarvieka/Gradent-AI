import { useEffect, useRef, useState } from 'react';
import type { CriterionResult, TextBlock } from '../../types';

interface HighlightRegion {
  id: string;
  criterionId: string;
  page: number;
  bbox: [number, number, number, number];
  status: string;
  text: string;
}

interface Props {
  submissionId: string;
  page: number;
  zoom: number;
  criteria: CriterionResult[];
  textBlocks: TextBlock[];
  selectedCriterionId: string | null;
  onSelectCriterion: (criterionId: string) => void;
  onPageCountLoaded: (count: number) => void;
}

export default function PdfViewerWithHighlights({
  submissionId,
  page,
  zoom,
  criteria,
  textBlocks,
  selectedCriterionId,
  onSelectCriterion,
  onPageCountLoaded,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState<number>(595);
  const [pageHeight, setPageHeight] = useState<number>(842);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch page image and metadata headers from backend API
  useEffect(() => {
    setLoading(true);
    setError(null);

    const url = `http://127.0.0.1:8000/api/grading/${submissionId}/page/${page}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Page ${page} not found`);

        const totalPagesHeader = res.headers.get('X-Total-Pages');
        const widthHeader = res.headers.get('X-Page-Width');
        const heightHeader = res.headers.get('X-Page-Height');

        if (totalPagesHeader) onPageCountLoaded(parseInt(totalPagesHeader, 10));
        if (widthHeader) setPageWidth(parseFloat(widthHeader));
        if (heightHeader) setPageHeight(parseFloat(heightHeader));

        return res.blob();
      })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to render PDF page');
        setLoading(false);
      });
  }, [submissionId, page, onPageCountLoaded]);

  // Build highlights for the current page
  const blockMap = new Map<string, TextBlock>(textBlocks.map((b) => [b.id, b]));
  const pageHighlights: HighlightRegion[] = [];

  criteria.forEach((c) => {
    (c.evidence_block_ids || []).forEach((blockId) => {
      const block = blockMap.get(blockId);
      if (block && block.page === page) {
        pageHighlights.push({
          id: `${c.rubric_item_id}_${blockId}`,
          criterionId: c.rubric_item_id,
          page: block.page,
          bbox: block.bbox,
          status: c.status,
          text: block.text,
        });
      }
    });
  });

  // Scroll to selected highlight if it exists on current page
  useEffect(() => {
    if (!selectedCriterionId || !containerRef.current) return;
    const selectedEl = containerRef.current.querySelector('.selected-highlight');
    if (selectedEl) {
      selectedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedCriterionId, page]);

  return (
    <div
      ref={containerRef}
      className="pdf-page-mock"
      style={{
        width: pageWidth,
        minHeight: pageHeight,
        padding: 0,
        overflow: 'hidden',
        position: 'relative',
        transform: `scale(${zoom / 100})`,
        transformOrigin: 'top center',
        background: '#fff',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: '#666' }}>
          Rendering Student PDF Page {page}…
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: 'var(--color-incorrect)' }}>
          {error}
        </div>
      )}

      {imageUrl && !loading && (
        <>
          <img
            src={imageUrl}
            alt={`Student Answer PDF Page ${page}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />

          {/* Translucent Soft Pastel Evidence Highlights */}
          {pageHighlights.map((hl) => {
            const [x0, y0, x1, y1] = hl.bbox;
            const leftPct = (x0 / pageWidth) * 100;
            const topPct = (y0 / pageHeight) * 100;
            const widthPct = ((x1 - x0) / pageWidth) * 100;
            const heightPct = ((y1 - y0) / pageHeight) * 100;

            const isSelected = selectedCriterionId === hl.criterionId;

            // Subtle translucent pastel colors
            let bgColor = 'rgba(249, 115, 22, 0.12)';
            let borderColor = 'rgba(249, 115, 22, 0.65)';

            if (hl.status === 'correct') {
              bgColor = 'rgba(34, 197, 94, 0.12)';
              borderColor = 'rgba(34, 197, 94, 0.65)';
            } else if (hl.status === 'incorrect') {
              bgColor = 'rgba(239, 68, 68, 0.12)';
              borderColor = 'rgba(239, 68, 68, 0.65)';
            }

            return (
              <div
                key={hl.id}
                className={isSelected ? 'selected-highlight' : ''}
                onClick={() => onSelectCriterion(hl.criterionId)}
                title={`Evidence for criterion (${hl.status}): ${hl.text}`}
                style={{
                  position: 'absolute',
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  backgroundColor: isSelected ? bgColor.replace('0.12', '0.25') : bgColor,
                  border: `2px solid ${borderColor}`,
                  borderRadius: 3,
                  cursor: 'pointer',
                  boxShadow: isSelected ? `0 0 0 3px ${borderColor}, var(--shadow-md)` : 'none',
                  zIndex: isSelected ? 10 : 2,
                  transition: 'all 150ms ease',
                }}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
