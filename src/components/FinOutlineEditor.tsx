import { useRef, useState, useCallback } from 'react';
import type { Point2D } from '../utils/smoothPath';
import { pointsToClosedSmoothPath } from '../utils/smoothPath';

const PAD = 6; // mm
const HIT_RADIUS = 1.6; // mm

function screenToMm(svg: SVGSVGElement, clientX: number, clientY: number): Point2D {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  const local = ctm ? pt.matrixTransform(ctm.inverse()) : pt;
  return { x: local.x, y: -local.y };
}

export default function FinOutlineEditor({
  points,
  onAdd,
  onUpdate,
  onDelete,
}: {
  points: Point2D[];
  onAdd: (p: Point2D) => void;
  onUpdate: (i: number, p: Point2D) => void;
  onDelete: (i: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs, 0) - PAD;
  const maxX = Math.max(...xs, 0) + PAD;
  const minY = Math.min(...ys, 0) - PAD;
  const maxY = Math.max(...ys, 0) + PAD;
  const width = maxX - minX;
  const height = maxY - minY;

  const path = pointsToClosedSmoothPath(points.map((p) => ({ x: p.x, y: -p.y })));

  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      if (dragIndex !== null) return;
      const svg = svgRef.current;
      if (!svg) return;
      onAdd(screenToMm(svg, e.clientX, e.clientY));
    },
    [dragIndex, onAdd],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (dragIndex === null) return;
      const svg = svgRef.current;
      if (!svg) return;
      onUpdate(dragIndex, screenToMm(svg, e.clientX, e.clientY));
    },
    [dragIndex, onUpdate],
  );

  const endDrag = useCallback(() => setDragIndex(null), []);

  return (
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
    </svg>
  );
}
