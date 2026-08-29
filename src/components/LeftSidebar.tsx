import { useRef, useState } from 'react';
import { useFeatureStore, type FeatureType } from '../store/useFeatureStore';
import { useSegmentsStore } from '../store/useSegmentsStore';

const ADD_OPTIONS: { type: FeatureType; label: string }[] = [
  { type: 'eyes', label: 'Eyes' },
  { type: 'lineTie', label: 'Line tie' },
  { type: 'hookHanger', label: 'Hook hanger' },
  { type: 'ballast', label: 'Ballast' },
  { type: 'wireFrame', label: 'Wire frame' },
  { type: 'fin', label: 'Fin' },
  { type: 'decal', label: 'Decal' },
  { type: 'scales', label: 'Scales' },
  { type: 'lip', label: 'Lip' },
  { type: 'spinnerBlade', label: 'Spinner blade' },
  { type: 'skirt', label: 'Skirt' },
];

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 20,
        height: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-dim)',
        borderRadius: 4,
        fontSize: 13,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

export default function LeftSidebar() {
  const features = useFeatureStore((s) => s.features);
  const selectedId = useFeatureStore((s) => s.selectedId);
  const addFeature = useFeatureStore((s) => s.addFeature);
  const removeFeature = useFeatureStore((s) => s.removeFeature);
  const toggleVisible = useFeatureStore((s) => s.toggleVisible);
  const selectFeature = useFeatureStore((s) => s.selectFeature);
  const reorderFeature = useFeatureStore((s) => s.reorderFeature);

  const segments = useSegmentsStore((s) => s.segments);
  const activeSegmentId = useSegmentsStore((s) => s.activeId);
  const addSegment = useSegmentsStore((s) => s.addSegment);
  const removeSegment = useSegmentsStore((s) => s.removeSegment);
  const setActiveSegmentId = useSegmentsStore((s) => s.setActiveId);

  const [menuOpen, setMenuOpen] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  return (
    <div
      style={{
        width: 260,
        flexShrink: 0,
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        Outline
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px', fontSize: 13 }}>
        <div style={{ padding: '4px 8px', color: 'var(--text-secondary)', fontWeight: 500 }}>
          Project
        </div>
        <div style={{ padding: '4px 8px 4px 22px', color: 'var(--text-dim)' }}>Environment</div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 8px',
          }}
        >
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Segments</span>
          <IconButton title="Add segment" onClick={() => addSegment()}>
            +
          </IconButton>
        </div>

        <div
          onClick={() => {
            setActiveSegmentId(null);
            selectFeature(null);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px 4px 22px',
            borderRadius: 4,
            cursor: 'pointer',
            background: activeSegmentId === null ? 'var(--accent-dim)' : 'transparent',
            color: activeSegmentId === null ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          Main body
        </div>

        {segments.map((seg) => {
          const isActive = seg.id === activeSegmentId;
          return (
            <div
              key={seg.id}
              onClick={() => {
                setActiveSegmentId(seg.id);
                selectFeature(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px 4px 22px',
                borderRadius: 4,
                cursor: 'pointer',
                background: isActive ? 'var(--accent-dim)' : 'transparent',
              }}
            >
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {seg.name}
              </span>
              <IconButton
                title="Remove segment"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSegment(seg.id);
                }}
              >
                ×
              </IconButton>
            </div>
          );
        })}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 8px',
            position: 'relative',
          }}
        >
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Body</span>
          <IconButton title="Add feature" onClick={() => setMenuOpen((v) => !v)}>
            +
          </IconButton>

          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 24,
                right: 4,
                zIndex: 10,
                background: 'var(--bg-panel-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                overflow: 'hidden',
                minWidth: 130,
              }}
            >
              {ADD_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => {
                    addFeature(opt.type);
                    setMenuOpen(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {features.map((feature, index) => {
          const isSelected = feature.id === selectedId;
          const isDragOver = dragOverIndex === index;
          return (
            <div
              key={feature.id}
              draggable
              onDragStart={() => {
                dragIndex.current = index;
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverIndex(index);
              }}
              onDragLeave={() => setDragOverIndex((v) => (v === index ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragIndex.current;
                setDragOverIndex(null);
                if (from !== null && from !== index) reorderFeature(from, index);
                dragIndex.current = null;
              }}
              onClick={() => {
                selectFeature(feature.id);
                setActiveSegmentId(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px 4px 22px',
                marginLeft: 0,
                borderRadius: 4,
                cursor: 'pointer',
                background: isSelected ? 'var(--accent-dim)' : 'transparent',
                borderTop: isDragOver ? '1px solid var(--accent)' : '1px solid transparent',
                opacity: feature.visible ? 1 : 0.45,
              }}
            >
              <span style={{ color: 'var(--text-dim)', cursor: 'grab', fontSize: 11 }}>⋮⋮</span>
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {feature.name}
              </span>
              <IconButton
                title={feature.visible ? 'Hide' : 'Show'}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVisible(feature.id);
                }}
              >
                {feature.visible ? '◉' : '○'}
              </IconButton>
              <IconButton
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFeature(feature.id);
                }}
              >
                ×
              </IconButton>
            </div>
          );
        })}
      </div>
    </div>
  );
}
