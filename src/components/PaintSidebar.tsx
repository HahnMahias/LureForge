import { usePaintStore, type PaintPattern } from '../store/usePaintStore';
import { useFeatureStore } from '../store/useFeatureStore';
import { PAINT_PATTERN_PRESETS, PAINT_PATTERNS } from '../utils/paintTexture';

const PATTERN_LABELS: Record<PaintPattern, string> = Object.fromEntries(
  PAINT_PATTERNS.map((p) => [p, PAINT_PATTERN_PRESETS[p].label]),
) as Record<PaintPattern, string>;

// A general-purpose lure-color palette, offered for all three paint roles
// (back/belly/accent) rather than three separate curated lists — the free
// <input type="color"> next to each row covers anything not in here.
const PAINT_COLOR_SWATCHES: { value: string; label: string }[] = [
  { value: '#1c1c1e', label: 'Black' },
  { value: '#f4f4f6', label: 'White' },
  { value: '#c9b278', label: 'Natural' },
  { value: '#7fd13b', label: 'Chartreuse' },
  { value: '#ff8c1a', label: 'Orange' },
  { value: '#c8342f', label: 'Red' },
  { value: '#c9ccd1', label: 'Silver' },
  { value: '#d8b23a', label: 'Gold' },
  { value: '#2f6e3a', label: 'Green' },
  { value: '#2a6bb0', label: 'Blue' },
];

// The four classic crankbait eye looks — see FeatureMarkers.tsx's EyesMarker
// for how eyeColor (iris)/pupilColor render as two nested spheres per eye.
const EYE_PRESETS: { label: string; eyeColor: string; pupilColor: string }[] = [
  { label: 'Classic yellow', eyeColor: '#f5c518', pupilColor: '#111111' },
  { label: 'Red', eyeColor: '#c8342f', pupilColor: '#111111' },
  { label: 'Silver / holo', eyeColor: '#c9ccd1', pupilColor: '#111111' },
  { label: 'Solid black', eyeColor: '#1c1c1e', pupilColor: '#1c1c1e' },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{children}</div>;
}

function ChoiceRow<T extends string>({
  options,
  value,
  labels,
  onChange,
}: {
  options: T[];
  value: T;
  labels: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              flex: '1 1 auto',
              padding: '6px 8px',
              borderRadius: 5,
              border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border-subtle)'),
              background: active ? 'var(--accent-dim)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: 12,
            }}
          >
            {labels[opt]}
          </button>
        );
      })}
    </div>
  );
}

function ColorSwatchRow({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {options.map((preset) => {
        const active = value.toLowerCase() === preset.value.toLowerCase();
        return (
          <button
            key={preset.value}
            title={preset.label}
            onClick={() => onChange(preset.value)}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: preset.value,
              border: '2px solid ' + (active ? 'var(--accent)' : 'var(--border-subtle)'),
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
        );
      })}
      <input
        type="color"
        value={value}
        title="Custom color"
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 24,
          height: 24,
          padding: 0,
          border: '1px solid var(--border-subtle)',
          borderRadius: 5,
          background: 'transparent',
          cursor: 'pointer',
        }}
      />
    </div>
  );
}

/**
 * The Paint tab's right panel: pattern choice, the three paint colors
 * (back/belly/accent — see utils/paintTexture.ts for how each pattern lays
 * them out), and eye coloring. Lives here rather than duplicated in the
 * Editor's own RightSidebar — this is the one place "how does the whole
 * lure look" is edited, same reasoning Simulate's own properties panel used
 * for keeping its summary in one place instead of scattering it.
 */
export default function PaintSidebar() {
  const pattern = usePaintStore((s) => s.pattern);
  const setPattern = usePaintStore((s) => s.setPattern);
  const backColor = usePaintStore((s) => s.backColor);
  const setBackColor = usePaintStore((s) => s.setBackColor);
  const bellyColor = usePaintStore((s) => s.bellyColor);
  const setBellyColor = usePaintStore((s) => s.setBellyColor);
  const accentColor = usePaintStore((s) => s.accentColor);
  const setAccentColor = usePaintStore((s) => s.setAccentColor);

  const features = useFeatureStore((s) => s.features);
  const updateFeature = useFeatureStore((s) => s.updateFeature);
  const eyesFeature = features.find((f) => f.type === 'eyes');

  const handlePatternChange = (next: PaintPattern) => {
    const preset = PAINT_PATTERN_PRESETS[next];
    setPattern(next);
    setBackColor(preset.backColor);
    setBellyColor(preset.bellyColor);
    setAccentColor(preset.accentColor);
  };

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        background: 'var(--bg-panel)',
        borderLeft: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
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
        Paint
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <SectionLabel>Pattern</SectionLabel>
          <ChoiceRow options={PAINT_PATTERNS} value={pattern} labels={PATTERN_LABELS} onChange={handlePatternChange} />
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>
            Picking a pattern loads a suggested back/belly/accent color set — tweak them below,
            it won&rsquo;t reset unless you pick a different pattern.
          </div>
        </div>

        <div>
          <SectionLabel>{pattern === 'solid' ? 'Color' : 'Back color'}</SectionLabel>
          <ColorSwatchRow options={PAINT_COLOR_SWATCHES} value={backColor} onChange={setBackColor} />
        </div>

        {pattern !== 'solid' && (
          <>
            <div>
              <SectionLabel>Belly color</SectionLabel>
              <ColorSwatchRow options={PAINT_COLOR_SWATCHES} value={bellyColor} onChange={setBellyColor} />
            </div>
            <div>
              <SectionLabel>Accent color</SectionLabel>
              <ColorSwatchRow options={PAINT_COLOR_SWATCHES} value={accentColor} onChange={setAccentColor} />
            </div>
          </>
        )}

        <div>
          <SectionLabel>Eyes</SectionLabel>
          {eyesFeature ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {EYE_PRESETS.map((preset) => {
                const active =
                  (eyesFeature.eyeColor ?? '#f5c518').toLowerCase() === preset.eyeColor.toLowerCase() &&
                  (eyesFeature.pupilColor ?? '#111111').toLowerCase() === preset.pupilColor.toLowerCase();
                return (
                  <button
                    key={preset.label}
                    title={preset.label}
                    onClick={() =>
                      updateFeature(eyesFeature.id, { eyeColor: preset.eyeColor, pupilColor: preset.pupilColor })
                    }
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: preset.eyeColor,
                      border: '2px solid ' + (active ? 'var(--accent)' : 'var(--border-subtle)'),
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: preset.pupilColor,
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
              No eyes on this lure yet. Add one from the &ldquo;+&rdquo; button in the Editor&rsquo;s
              outline sidebar to color them here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
