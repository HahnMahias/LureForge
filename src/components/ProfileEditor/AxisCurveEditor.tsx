import { useRef, useState, useCallback, useEffect } from 'react';
import type { Point2D } from '../../utils/smoothPath';
import { pointsToSmoothPath } from '../../utils/smoothPath';

const PAD_X = 15;
const PAD_Y = 15;
const GRID_STEP = 10; // mm
const HIT_RADIUS = 4; // mm, invisible pointer target (bigger than the visible dot)
const DRAG_THRESHOLD = 0.6; // mm of movement before a pointerdown counts as a drag, not a click

function screenToMm(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  worldHeight: number,
): Point2D {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  const local = ctm ? pt.matrixTransform(ctm.inverse()) : pt;
  return {
    x: local.x - PAD_X,
    y: worldHeight / 2 - local.y,
  };
}

interface Side {
  points: Point2D[];
  onAdd: (p: Point2D) => void;
  onUpdate: (i: number, p: Point2D) => void;
  onDelete: (i: number) => void;
  editable: boolean;
}

export interface ReferenceImageTransform {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
}

export interface AxisCurveEditorProps {
  axisLength: number; // mm, x range is 0..axisLength
  maxExtent: number; // mm, soft clamp for y
  primary: Side;
  mirror: Side;
  symmetric: boolean;
  referenceImage?: ReferenceImageTransform;
  onImageTransform?: (t: Partial<Omit<ReferenceImageTransform, 'url'>>) => void;
}

export default function AxisCurveEditor({
  axisLength,
  maxExtent,
  primary,
  mirror,
  symmetric,
  referenceImage,
  onImageTransform,
}: AxisCurveEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ side: 'primary' | 'mirror'; index: number } | null>(
    null,
  );
  const [hover, setHover] = useState<{ side: 'primary' | 'mirror'; index: number } | null>(null);
  const backgroundDrag = useRef<{
    startMmX: number;
    startMmY: number;
    startImgX: number;
    startImgY: number;
    moved: boolean;
  } | null>(null);

  const worldWidth = axisLength + PAD_X * 2;
  const worldHeight = maxExtent * 2 + PAD_Y * 2;

  const toSvg = (side: Side, mirrored: boolean) =>
    pointsToSmoothPath(
      side.points.map((p) => ({
        x: p.x + PAD_X,
        y: mirrored ? worldHeight / 2 + p.y : worldHeight / 2 - p.y,
      })),
    );

  const primaryPath = toSvg(primary, false);
  const mirrorPath = toSvg(symmetric ? primary : mirror, true);

  const clampFor = useCallback(
    (side: Side, index: number, mmX: number, mmY: number) => {
      const isFirst = index === 0;
      const isLast = index === side.points.length - 1;
      const prev = side.points[index - 1];
      const next = side.points[index + 1];

      let x = side.points[index].x;
      if (isFirst) {
        x = 0;
      } else if (isLast) {
        x = axisLength;
      } else {
        const minX = prev ? prev.x + 1 : 0;
        const maxX = next ? next.x - 1 : axisLength;
        x = Math.min(Math.max(mmX, minX), maxX);
      }

      const y = Math.min(Math.max(mmY, 0), maxExtent + PAD_Y);
      return { x, y };
    },
    [axisLength, maxExtent],
  );

  const addPointAt = useCallback(
    (mm: Point2D) => {
      const x = Math.min(Math.max(mm.x, 0), axisLength);
      if (mm.y >= 0 || symmetric) {
        const y = Math.min(Math.max(Math.abs(mm.y), 0), maxExtent + PAD_Y);
        primary.onAdd({ x, y });
      } else {
        const y = Math.min(Math.max(-mm.y, 0), maxExtent + PAD_Y);
        mirror.onAdd({ x, y });
      }
    },
    [axisLength, maxExtent, symmetric, primary, mirror],
  );

  const handleBackgroundPointerDown = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (dragging) return;
      const svg = svgRef.current;
      if (!svg) return;
      const mm = screenToMm(svg, e.clientX, e.clientY, worldHeight);
      backgroundDrag.current = {
        startMmX: mm.x,
        startMmY: mm.y,
        startImgX: referenceImage?.x ?? 0,
        startImgY: referenceImage?.y ?? 0,
        moved: false,
      };
    },
    [dragging, worldHeight, referenceImage],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;

      if (dragging) {
        const mm = screenToMm(svg, e.clientX, e.clientY, worldHeight);
        const side = dragging.side === 'primary' ? primary : mirror;
        const targetY = dragging.side === 'primary' ? mm.y : -mm.y;
        const { x, y } = clampFor(side, dragging.index, mm.x, targetY);
        side.onUpdate(dragging.index, { x, y });
        return;
      }

      const bg = backgroundDrag.current;
      if (bg && referenceImage && onImageTransform) {
        const mm = screenToMm(svg, e.clientX, e.clientY, worldHeight);
        const dx = mm.x - bg.startMmX;
        const dy = mm.y - bg.startMmY;
        if (!bg.moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
          bg.moved = true;
        }
        if (bg.moved) {
          onImageTransform({ x: bg.startImgX + dx, y: bg.startImgY + dy });
        }
      }
    },
    [dragging, worldHeight, primary, mirror, clampFor, referenceImage, onImageTransform],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      setDragging(null);
      const bg = backgroundDrag.current;
      if (bg) {
        if (!bg.moved) {
          const svg = svgRef.current;
          if (svg) addPointAt(screenToMm(svg, e.clientX, e.clientY, worldHeight));
        }
        backgroundDrag.current = null;
      }
    },
    [addPointAt, worldHeight],
  );

  // React's synthetic onWheel is registered passive, so preventDefault()
  // there only warns — attach a real listener to actually stop page scroll
  // while zooming the reference photo.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !referenceImage || !onImageTransform) return;
    const listener = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const newWidth = Math.min(Math.max(referenceImage.width * factor, 5), axisLength * 20);
      const newHeight = referenceImage.height * (newWidth / referenceImage.width);
      onImageTransform({ width: newWidth, height: newHeight });
    };
    svg.addEventListener('wheel', listener, { passive: false });
    return () => svg.removeEventListener('wheel', listener);
  }, [referenceImage, onImageTransform, axisLength]);

  const vLines: number[] = [];
  for (let x = 0; x <= axisLength; x += GRID_STEP) vLines.push(x);
  const hLines: number[] = [];
  for (let y = -Math.floor(worldHeight / 2); y <= worldHeight / 2; y += GRID_STEP) {
    hLines.push(y);
  }

  const renderPoints = (side: Side, key: 'primary' | 'mirror', mirrored: boolean) => {
    if (!side.editable) return null;
    return side.points.map((p, i) => {
      const cx = p.x + PAD_X;
      const cy = mirrored ? worldHeight / 2 + p.y : worldHeight / 2 - p.y;
      const isHover = (hover?.side === key && hover.index === i) || (dragging?.side === key && dragging.index === i);
      return (
        <g key={`${key}${i}`}>
          <circle
            cx={cx}
            cy={cy}
            r={HIT_RADIUS}
            fill="transparent"
            style={{ cursor: 'grab' }}
            onPointerEnter={() => setHover({ side: key, index: i })}
            onPointerLeave={() => setHover(null)}
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.target as Element).setPointerCapture(e.pointerId);
              setDragging({ side: key, index: i });
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (i !== 0 && i !== side.points.length - 1) side.onDelete(i);
            }}
          />
          <circle
            cx={cx}
            cy={cy}
            r={isHover ? 2.6 : 1.8}
            fill={isHover ? 'var(--accent)' : '#e8e8ea'}
            stroke="#0a0a0b"
            strokeWidth={0.4}
            pointerEvents="none"
          />
        </g>
      );
    });
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${worldWidth} ${worldHeight}`}
        style={{ width: '100%', height: '100%', background: 'var(--bg-app)', touchAction: 'none' }}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        {vLines.map((x) => (
          <line
            key={`v${x}`}
            x1={x + PAD_X}
            y1={0}
            x2={x + PAD_X}
            y2={worldHeight}
            stroke="var(--border-subtle)"
            strokeWidth={x === 0 ? 0.6 : 0.2}
          />
        ))}
        {hLines.map((y) => (
          <line
            key={`h${y}`}
            x1={0}
            y1={worldHeight / 2 - y}
            x2={worldWidth}
            y2={worldHeight / 2 - y}
            stroke="var(--border-subtle)"
            strokeWidth={y === 0 ? 0.6 : 0.2}
          />
        ))}

        {referenceImage && (
          <image
            href={referenceImage.url}
            x={referenceImage.x + PAD_X}
            y={worldHeight / 2 - referenceImage.y - referenceImage.height}
            width={referenceImage.width}
            height={referenceImage.height}
            opacity={referenceImage.opacity}
            preserveAspectRatio="none"
            style={{ pointerEvents: 'none' }}
          />
        )}

        <rect
          x={0}
          y={0}
          width={worldWidth}
          height={worldHeight}
          fill="transparent"
          onPointerDown={handleBackgroundPointerDown}
          style={{ cursor: referenceImage ? 'grab' : 'crosshair' }}
        />

        <path d={primaryPath} fill="none" stroke="var(--accent)" strokeWidth={0.8} />
        <path
          d={mirrorPath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={0.8}
          opacity={symmetric ? 0.45 : 0.85}
        />

        {renderPoints(primary, 'primary', false)}
        {!symmetric && renderPoints(mirror, 'mirror', true)}
      </svg>
    </div>
  );
}
