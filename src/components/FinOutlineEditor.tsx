import { useRef, useState, useCallback, useMemo } from 'react';
import type { Point2D } from '../utils/smoothPath';
import { pointsToClosedSmoothPath } from '../utils/smoothPath';

const PAD = 6; // mm
const HIT_RADIUS = 1.6; // mm
const HANDLE_HIT_RADIUS = 2.2; // mm
const MIN_IMAGE_SIZE = 3; // mm, floor so a corner-drag can't invert the rect

export interface FinReferenceImageRect {
  x: number; // mm, left edge, same local space as the fin outline points
  y: number; // mm, bottom edge — image extends upward/rightward from here
  width: number;
  height: number;
}

type CornerHandle = 'bl' | 'br' | 'tl' | 'tr';

function screenToMm(svg: SVGSVGElement, clientX: number, clientY: number): Point2D {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  const local = ctm ? pt.matrixTransform(ctm.inverse()) : pt;
  return { x: local.x, y: -local.y };
}

// Opposite-corner-anchored resize: the corner being dragged moves to the
// pointer, the diagonally opposite corner stays put — "you adjust the photo
// itself" rather than tweaking width/height as separate fields.
function resizeRect(
  handle: CornerHandle,
  mm: Point2D,
  rect: FinReferenceImageRect,
): FinReferenceImageRect {
  const anchorX = handle === 'bl' || handle === 'tl' ? rect.x + rect.width : rect.x;
  const anchorY = handle === 'bl' || handle === 'br' ? rect.y + rect.height : rect.y;
  const growsRight = handle === 'br' || handle === 'tr';
  const growsUp = handle === 'tl' || handle === 'tr';

  const x = growsRight ? anchorX : Math.min(mm.x, anchorX - MIN_IMAGE_SIZE);
  const width = growsRight ? Math.max(mm.x - anchorX, MIN_IMAGE_SIZE) : anchorX - x;
  const y = growsUp ? anchorY : Math.min(mm.y, anchorY - MIN_IMAGE_SIZE);
  const height = growsUp ? Math.max(mm.y - anchorY, MIN_IMAGE_SIZE) : anchorY - y;

  return { x, y, width, height };
}

export default function FinOutlineEditor({
  points,
  onAdd,
  onUpdate,
  onDelete,
  referenceImage,
  referenceImageRect,
  onSetImage,
  onImageRectChange,
  onClearImage,
  bodySide,
  bodySideMirror,
  bodyOrigin,
}: {
  points: Point2D[];
  onAdd: (p: Point2D) => void;
  onUpdate: (i: number, p: Point2D) => void;
  onDelete: (i: number) => void;
  // Fase A — a user-uploaded photo (e.g. a real fin's silhouette) traced
  // over with the same click-to-add-point interaction the outline already
  // uses. `referenceImage` is a data-URL; the rect lives in the same local
  // mm space as `points` so a fin drawn over it lines up 1:1.
  referenceImage?: string;
  referenceImageRect?: FinReferenceImageRect;
  onSetImage?: (dataUrl: string, rect: FinReferenceImageRect) => void;
  onImageRectChange?: (rect: FinReferenceImageRect) => void;
  onClearImage?: () => void;
  // Fase B — the body's own side silhouette (useProfileStore's curves.side/
  // sideMirror, the same data the 3D body itself is built from), shifted so
  // the fin's mount point sits at local (0,0), shown as a faint guide when
  // there's no reference photo covering it.
  bodySide?: Point2D[];
  bodySideMirror?: Point2D[];
  bodyOrigin?: Point2D;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [dragHandle, setDragHandle] = useState<CornerHandle | 'move' | null>(null);
  const moveStart = useRef<{ mm: Point2D; rect: FinReferenceImageRect } | null>(null);

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs, 0) - PAD;
  const maxX = Math.max(...xs, 0) + PAD;
  const minY = Math.min(...ys, 0) - PAD;
  const maxY = Math.max(...ys, 0) + PAD;
  const width = maxX - minX;
  const height = maxY - minY;

  const path = pointsToClosedSmoothPath(points.map((p) => ({ x: p.x, y: -p.y })));

  const bodyPath = useMemo(() => {
    if (!bodySide?.length || !bodySideMirror?.length) return null;
    const ox = bodyOrigin?.x ?? 0;
    const oy = bodyOrigin?.y ?? 0;
    const top = bodySide.map((p) => ({ x: p.x - ox, y: p.y - oy }));
    const bottom = [...bodySideMirror.map((p) => ({ x: p.x - ox, y: -p.y - oy }))].reverse();
    return pointsToClosedSmoothPath([...top, ...bottom].map((p) => ({ x: p.x, y: -p.y })));
  }, [bodySide, bodySideMirror, bodyOrigin]);

  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      if (dragIndex !== null || dragHandle !== null) return;
      const svg = svgRef.current;
      if (!svg) return;
      onAdd(screenToMm(svg, e.clientX, e.clientY));
    },
    [dragIndex, dragHandle, onAdd],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;

      if (dragIndex !== null) {
        onUpdate(dragIndex, screenToMm(svg, e.clientX, e.clientY));
        return;
      }

      if (dragHandle && referenceImageRect && onImageRectChange) {
        const mm = screenToMm(svg, e.clientX, e.clientY);
        if (dragHandle === 'move') {
          const start = moveStart.current;
          if (!start) return;
          const dx = mm.x - start.mm.x;
          const dy = mm.y - start.mm.y;
          onImageRectChange({ ...start.rect, x: start.rect.x + dx, y: start.rect.y + dy });
        } else {
          onImageRectChange(resizeRect(dragHandle, mm, referenceImageRect));
        }
      }
    },
    [dragIndex, dragHandle, onUpdate, referenceImageRect, onImageRectChange],
  );

  const endDrag = useCallback(() => {
    setDragIndex(null);
    setDragHandle(null);
    moveStart.current = null;
  }, []);

  const handlePhotoSelected = useCallback(
    (file: File | undefined) => {
      if (!file || !onSetImage) return;
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const aspect = img.naturalHeight / img.naturalWidth || 1;
          const targetWidth = Math.max(width * 0.7, 10);
          const targetHeight = targetWidth * aspect;
          onSetImage(url, {
            x: (minX + maxX) / 2 - targetWidth / 2,
            y: (minY + maxY) / 2 - targetHeight / 2,
            width: targetWidth,
            height: targetHeight,
          });
        };
        img.src = url;
      };
      reader.readAsDataURL(file);
    },
    [onSetImage, width, minX, maxX, minY, maxY],
  );

  const imgScreen = referenceImageRect
    ? {
        x: referenceImageRect.x,
        y: -(referenceImageRect.y + referenceImageRect.height),
        width: referenceImageRect.width,
        height: referenceImageRect.height,
      }
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {onSetImage && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => handlePhotoSelected(e.target.files?.[0])}
          />
          <button
            title="Upload reference photo"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 8px',
              borderRadius: 5,
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 11,
            }}
          >
            🖼 {referenceImage ? 'Replace photo' : 'Upload photo'}
          </button>
          {referenceImage && onClearImage && (
            <button
              onClick={onClearImage}
              style={{
                padding: '4px 8px',
                borderRadius: 5,
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 11,
              }}
            >
              Remove
            </button>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`${minX} ${-maxY} ${width} ${height}`}
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          background: 'var(--bg-app)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          touchAction: 'none',
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        {!referenceImage && bodyPath && (
          <path d={bodyPath} fill="var(--text-dim)" fillOpacity={0.16} stroke="none" />
        )}

        {imgScreen && referenceImage && (
          <image
            href={referenceImage}
            x={imgScreen.x}
            y={imgScreen.y}
            width={imgScreen.width}
            height={imgScreen.height}
            preserveAspectRatio="none"
            style={{ pointerEvents: 'none' }}
          />
        )}

        <line x1={minX} y1={0} x2={maxX} y2={0} stroke="var(--border-subtle)" strokeWidth={width * 0.003} />
        <line x1={0} y1={-maxY} x2={0} y2={-minY} stroke="var(--border-subtle)" strokeWidth={width * 0.003} />

        <rect x={minX} y={-maxY} width={width} height={height} fill="transparent" onClick={handleBackgroundClick} style={{ cursor: 'crosshair' }} />

        <path d={path} fill="var(--accent-dim)" fillOpacity={0.4} stroke="var(--accent)" strokeWidth={width * 0.01} />

        {points.map((p, i) => {
          const cx = p.x;
          const cy = -p.y;
          const isHover = hoverIndex === i || dragIndex === i;
          const r = width * (isHover ? 0.035 : 0.025);
          return (
            <g key={i}>
              <circle
                cx={cx}
                cy={cy}
                r={HIT_RADIUS}
                fill="transparent"
                style={{ cursor: 'grab' }}
                onPointerEnter={() => setHoverIndex(i)}
                onPointerLeave={() => setHoverIndex(null)}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  (e.target as Element).setPointerCapture(e.pointerId);
                  setDragIndex(i);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onDelete(i);
                }}
              />
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={isHover ? 'var(--accent)' : '#e8e8ea'}
                stroke="#0a0a0b"
                strokeWidth={width * 0.004}
                pointerEvents="none"
              />
            </g>
          );
        })}

        {imgScreen && referenceImageRect && onImageRectChange && (
          <g>
            <rect
              x={imgScreen.x}
              y={imgScreen.y}
              width={imgScreen.width}
              height={imgScreen.height}
              fill="none"
              stroke="var(--accent)"
              strokeDasharray={`${width * 0.01} ${width * 0.01}`}
              strokeWidth={width * 0.004}
              pointerEvents="none"
            />
            {/* Center move handle — drag to reposition the whole photo. */}
            <rect
              x={imgScreen.x + imgScreen.width / 2 - HANDLE_HIT_RADIUS}
              y={imgScreen.y + imgScreen.height / 2 - HANDLE_HIT_RADIUS}
              width={HANDLE_HIT_RADIUS * 2}
              height={HANDLE_HIT_RADIUS * 2}
              fill="var(--accent)"
              opacity={0.8}
              style={{ cursor: 'move' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.target as Element).setPointerCapture(e.pointerId);
                moveStart.current = { mm: screenToMm(e.currentTarget.ownerSVGElement!, e.clientX, e.clientY), rect: referenceImageRect };
                setDragHandle('move');
              }}
            />
            {([
              ['bl', referenceImageRect.x, referenceImageRect.y],
              ['br', referenceImageRect.x + referenceImageRect.width, referenceImageRect.y],
              ['tl', referenceImageRect.x, referenceImageRect.y + referenceImageRect.height],
              ['tr', referenceImageRect.x + referenceImageRect.width, referenceImageRect.y + referenceImageRect.height],
            ] as [CornerHandle, number, number][]).map(([handle, mmX, mmY]) => (
              <circle
                key={handle}
                cx={mmX}
                cy={-mmY}
                r={HANDLE_HIT_RADIUS}
                fill="#0a0a0b"
                stroke="var(--accent)"
                strokeWidth={width * 0.005}
                style={{ cursor: handle === 'bl' || handle === 'tr' ? 'nwse-resize' : 'nesw-resize' }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  (e.target as Element).setPointerCapture(e.pointerId);
                  setDragHandle(handle);
                }}
              />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
