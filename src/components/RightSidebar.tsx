import {
  useFeatureStore,
  type Position3D,
  type LineTieStyle,
  type DecalStyle,
  type DecalFill,
  type LipShape,
  type BladeShape,
} from '../store/useFeatureStore';
import { useProfileStore } from '../store/useProfileStore';
import type { BallastShape } from '../utils/meshVolume';
import type { MetalType } from '../utils/materials';
import { WIRE_FRAME_DEFS, WIRE_FRAME_STYLES, type WireFrameStyle } from '../data/wireFrameDefs';
import { DECAL_PATTERNS, DECAL_PRESETS, type DecalPattern } from '../data/decalPresets';
import FinOutlineEditor from './FinOutlineEditor';

const TYPE_LABELS: Record<string, string> = {
  eyes: 'Eyes',
  lineTie: 'Line tie',
  hookHanger: 'Hook hanger',
  ballast: 'Ballast',
  wireFrame: 'Wire frame',
  fin: 'Fin',
  decal: 'Decal',
  scales: 'Scales',
  lip: 'Lip',
  spinnerBlade: 'Spinner blade',
  skirt: 'Skirt',
};

const SHAPES: BallastShape[] = ['sphere', 'box', 'cylinder'];
const METALS: MetalType[] = ['lead', 'tungsten', 'steel'];
const LINE_TIE_STYLES: LineTieStyle[] = ['ring', 'staple', 'screwEye'];
const LINE_TIE_STYLE_LABELS: Record<LineTieStyle, string> = {
  ring: 'Ring',
  staple: 'Staple',
  screwEye: 'Screw eye',
};
const DECAL_STYLES: DecalStyle[] = ['flat', 'ramp'];
const DECAL_STYLE_LABELS: Record<DecalStyle, string> = { flat: 'Flat', ramp: 'Ramp' };
const DECAL_FILLS: DecalFill[] = ['rounded', 'engraved'];
const DECAL_FILL_LABELS: Record<DecalFill, string> = { rounded: 'Rounded', engraved: 'Engraved' };
const DECAL_PATTERN_LABELS: Record<DecalPattern, string> = Object.fromEntries(
  DECAL_PATTERNS.map((p) => [p, DECAL_PRESETS[p].label]),
) as Record<DecalPattern, string>;
const LIP_SHAPES: LipShape[] = ['round', 'square', 'coffin'];
const LIP_SHAPE_LABELS: Record<LipShape, string> = { round: 'Round', square: 'Square', coffin: 'Coffin' };
const BLADE_SHAPES: BladeShape[] = ['colorado', 'willow', 'indiana'];
const BLADE_SHAPE_LABELS: Record<BladeShape, string> = { colorado: 'Colorado', willow: 'Willow', indiana: 'Indiana' };
const SKIRT_COLOR_PRESETS: { value: string; label: string }[] = [
  { value: '#c8342f', label: 'Red' },
  { value: '#1c1c1e', label: 'Black' },
  { value: '#2f6e3a', label: 'Green' },
  { value: '#d8b23a', label: 'Chartreuse' },
  { value: '#e8e8ea', label: 'White' },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{children}</div>
  );
}

function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Record<T, string>;
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: 5,
              border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border-subtle)'),
              background: active ? 'var(--accent-dim)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: 12,
              textTransform: labels ? 'none' : 'capitalize',
            }}
          >
            {labels ? labels[opt] : opt}
          </button>
        );
      })}
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 0.5,
  unit = 'mm',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      <span style={{ color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span style={{ color: 'var(--text-dim)' }}>
          {Math.round(value * 10) / 10} {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
    </label>
  );
}

function AxisField({
  axis,
  value,
  onChange,
}: {
  axis: keyof Position3D;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
      <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{axis}</span>
      <input
        type="number"
        value={Math.round(value * 10) / 10}
        step={1}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
        style={{
          width: '100%',
          padding: '6px 8px',
          background: 'var(--bg-panel-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 5,
          color: 'var(--text-primary)',
          fontSize: 13,
        }}
      />
    </label>
  );
}

export default function RightSidebar() {
  const features = useFeatureStore((s) => s.features);
  const selectedId = useFeatureStore((s) => s.selectedId);
  const updatePosition = useFeatureStore((s) => s.updatePosition);
  const updateRotation = useFeatureStore((s) => s.updateRotation);
  const updateFeature = useFeatureStore((s) => s.updateFeature);
  const addFinPoint = useFeatureStore((s) => s.addFinPoint);
  const updateFinPoint = useFeatureStore((s) => s.updateFinPoint);
  const deleteFinPoint = useFeatureStore((s) => s.deleteFinPoint);
  const length = useProfileStore((s) => s.length);
  const girth = useProfileStore((s) => s.girth);

  const selected = features.find((f) => f.id === selectedId) ?? null;

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
        Properties
      </div>

      {selected ? (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {selected.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
              {TYPE_LABELS[selected.type]}
            </div>
          </div>

          {selected.type === 'ballast' ? (
            <>
              <div>
                <SectionLabel>Shape</SectionLabel>
                <ChoiceRow
                  options={SHAPES}
                  value={selected.shape ?? 'sphere'}
                  onChange={(shape) => updateFeature(selected.id, { shape })}
                />
              </div>

              <SliderField
                label="Diameter"
                value={selected.diameterMm ?? 6}
                min={1}
                max={Math.max(girth * 0.9, 2)}
                onChange={(diameterMm) => updateFeature(selected.id, { diameterMm })}
              />

              <div>
                <SectionLabel>Metal</SectionLabel>
                <ChoiceRow
                  options={METALS}
                  value={selected.metal ?? 'lead'}
                  onChange={(metal) => updateFeature(selected.id, { metal })}
                />
              </div>

              {selected.shape !== 'sphere' && (
                <SliderField
                  label="Rotate Y"
                  value={selected.rotation?.y ?? 0}
                  min={-180}
                  max={180}
                  step={1}
                  unit="°"
                  onChange={(y) => updateRotation(selected.id, { y })}
                />
              )}

              <SliderField
                label="Position X"
                value={selected.position.x}
                min={0}
                max={length}
                onChange={(x) => updatePosition(selected.id, { x })}
              />
              <SliderField
                label="Position Z"
                value={selected.position.z}
                min={-girth / 2}
                max={girth / 2}
                onChange={(z) => updatePosition(selected.id, { z })}
              />

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Clearance (mm)</span>
                <input
                  type="number"
                  value={selected.ballastClearanceMm ?? 1.5}
                  min={0}
                  step={0.1}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v) && v >= 0) updateFeature(selected.id, { ballastClearanceMm: v });
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    background: 'var(--bg-panel-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 5,
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  Minimum gap required from the body&rsquo;s hollowed inner wall — flagged in
                  Export if too tight.
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={selected.holdingPocket ?? false}
                  onChange={(e) => updateFeature(selected.id, { holdingPocket: e.target.checked })}
                />
                Holding pocket
              </label>
            </>
          ) : selected.type === 'wireFrame' ? (
            <div>
              <SectionLabel>Style</SectionLabel>
              <select
                value={selected.wireFrameStyle ?? 'throughWire'}
                onChange={(e) =>
                  updateFeature(selected.id, { wireFrameStyle: e.target.value as WireFrameStyle })
                }
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'var(--bg-panel-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 5,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                }}
              >
                {WIRE_FRAME_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {WIRE_FRAME_DEFS[style].label}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.5 }}>
                {WIRE_FRAME_DEFS[selected.wireFrameStyle ?? 'throughWire'].description}
              </div>
            </div>
          ) : selected.type === 'scales' ? (
            <>
              <div>
                <SectionLabel>Coverage (% of length)</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <SliderField
                    label="Start"
                    value={selected.scalesCoverageStart ?? 0}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    onChange={(scalesCoverageStart) => updateFeature(selected.id, { scalesCoverageStart })}
                  />
                  <SliderField
                    label="End"
                    value={selected.scalesCoverageEnd ?? 100}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    onChange={(scalesCoverageEnd) => updateFeature(selected.id, { scalesCoverageEnd })}
                  />
                </div>
              </div>

              <SliderField
                label="Scale size"
                value={selected.scalesSize ?? 6}
                min={1.5}
                max={20}
                step={0.5}
                onChange={(scalesSize) => updateFeature(selected.id, { scalesSize })}
              />

              <SliderField
                label="Depth"
                value={selected.scalesDepth ?? 0.5}
                min={0}
                max={1.5}
                step={0.05}
                unit=""
                onChange={(scalesDepth) => updateFeature(selected.id, { scalesDepth })}
              />

              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                Procedural surface texture — this is a rendering-only effect and doesn&rsquo;t
                change the exported STL&rsquo;s geometry, the same way fine print/paint detail
                normally works.
              </div>
            </>
          ) : (
            <>
              <div>
                <SectionLabel>Position (mm)</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {(['x', 'y', 'z'] as const).map((axis) => (
                    <AxisField
                      key={axis}
                      axis={axis}
                      value={selected.position[axis]}
                      onChange={(v) => updatePosition(selected.id, { [axis]: v })}
                    />
                  ))}
                </div>
              </div>

              {selected.type === 'lineTie' && (
                <>
                  <div>
                    <SectionLabel>Style</SectionLabel>
                    <ChoiceRow
                      options={LINE_TIE_STYLES}
                      value={selected.lineTieStyle ?? 'ring'}
                      labels={LINE_TIE_STYLE_LABELS}
                      onChange={(lineTieStyle) => updateFeature(selected.id, { lineTieStyle })}
                    />
                  </div>

                  <div>
                    <SectionLabel>Rotation</SectionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(['x', 'y', 'z'] as const).map((axis) => (
                        <SliderField
                          key={axis}
                          label={axis.toUpperCase()}
                          unit="°"
                          value={selected.rotation?.[axis] ?? 0}
                          min={-180}
                          max={180}
                          step={1}
                          onChange={(v) => updateRotation(selected.id, { [axis]: v })}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selected.type === 'fin' && (
                <>
                  <div>
                    <SectionLabel>Outline</SectionLabel>
                    <FinOutlineEditor
                      points={selected.finOutline ?? []}
                      onAdd={(p) => addFinPoint(selected.id, p)}
                      onUpdate={(i, p) => updateFinPoint(selected.id, i, p)}
                      onDelete={(i) => deleteFinPoint(selected.id, i)}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                      Click to add a point, drag to reposition, double-click to remove.
                    </div>
                  </div>

                  <SliderField
                    label="Thickness"
                    value={selected.finThickness ?? 1.5}
                    min={0.5}
                    max={8}
                    step={0.1}
                    onChange={(finThickness) => updateFeature(selected.id, { finThickness })}
                  />

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={selected.finMirror ?? false}
                      onChange={(e) => updateFeature(selected.id, { finMirror: e.target.checked })}
                    />
                    Mirror across center
                  </label>

                  <div>
                    <SectionLabel>Rotation</SectionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(['x', 'y', 'z'] as const).map((axis) => (
                        <SliderField
                          key={axis}
                          label={axis.toUpperCase()}
                          unit="°"
                          value={selected.rotation?.[axis] ?? 0}
                          min={-180}
                          max={180}
                          step={1}
                          onChange={(v) => updateRotation(selected.id, { [axis]: v })}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selected.type === 'decal' && (
                <>
                  <div>
                    <SectionLabel>Pattern</SectionLabel>
                    <ChoiceRow
                      options={DECAL_PATTERNS}
                      value={selected.decalPattern ?? 'star'}
                      labels={DECAL_PATTERN_LABELS}
                      onChange={(decalPattern) => updateFeature(selected.id, { decalPattern })}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                      Built-in shapes for now — custom image/text upload isn&rsquo;t implemented
                      yet.
                    </div>
                  </div>

                  <div>
                    <SectionLabel>Style</SectionLabel>
                    <ChoiceRow
                      options={DECAL_STYLES}
                      value={selected.decalStyle ?? 'flat'}
                      labels={DECAL_STYLE_LABELS}
                      onChange={(decalStyle) => updateFeature(selected.id, { decalStyle })}
                    />
                  </div>

                  <div>
                    <SectionLabel>Fill</SectionLabel>
                    <ChoiceRow
                      options={DECAL_FILLS}
                      value={selected.decalFill ?? 'rounded'}
                      labels={DECAL_FILL_LABELS}
                      onChange={(decalFill) => updateFeature(selected.id, { decalFill })}
                    />
                  </div>

                  <SliderField
                    label="Depth"
                    value={selected.decalDepth ?? 1}
                    min={0.2}
                    max={4}
                    step={0.1}
                    onChange={(decalDepth) => updateFeature(selected.id, { decalDepth })}
                  />

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={selected.decalMirror ?? false}
                      onChange={(e) => updateFeature(selected.id, { decalMirror: e.target.checked })}
                    />
                    Mirror across center
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={selected.decalReadableBothSides ?? false}
                      onChange={(e) =>
                        updateFeature(selected.id, { decalReadableBothSides: e.target.checked })
                      }
                    />
                    Readable on both sides
                  </label>
                </>
              )}

              {selected.type === 'lip' && (
                <>
                  <div>
                    <SectionLabel>Shape</SectionLabel>
                    <ChoiceRow
                      options={LIP_SHAPES}
                      value={selected.lipShape ?? 'round'}
                      labels={LIP_SHAPE_LABELS}
                      onChange={(lipShape) => updateFeature(selected.id, { lipShape })}
                    />
                  </div>

                  <SliderField
                    label="Angle"
                    value={selected.lipAngleDeg ?? 45}
                    min={0}
                    max={90}
                    step={1}
                    unit="°"
                    onChange={(lipAngleDeg) => updateFeature(selected.id, { lipAngleDeg })}
                  />

                  <SliderField
                    label="Width"
                    value={selected.lipWidthMm ?? 14}
                    min={4}
                    max={Math.max(girth, 10)}
                    step={0.5}
                    onChange={(lipWidthMm) => updateFeature(selected.id, { lipWidthMm })}
                  />

                  <SliderField
                    label="Length"
                    value={selected.lipLengthMm ?? 18}
                    min={4}
                    max={Math.max(length * 0.4, 10)}
                    step={0.5}
                    onChange={(lipLengthMm) => updateFeature(selected.id, { lipLengthMm })}
                  />

                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    A steeper angle dives deeper during &ldquo;Reel in&rdquo;. 90° points straight
                    down.
                  </div>
                </>
              )}

              {selected.type === 'spinnerBlade' && (
                <>
                  <div>
                    <SectionLabel>Blade shape</SectionLabel>
                    <ChoiceRow
                      options={BLADE_SHAPES}
                      value={selected.bladeShape ?? 'colorado'}
                      labels={BLADE_SHAPE_LABELS}
                      onChange={(bladeShape) => updateFeature(selected.id, { bladeShape })}
                    />
                  </div>

                  <SliderField
                    label="Size"
                    value={selected.bladeSizeMm ?? 16}
                    min={6}
                    max={40}
                    step={1}
                    onChange={(bladeSizeMm) => updateFeature(selected.id, { bladeSizeMm })}
                  />

                  <div>
                    <SectionLabel>Rotation</SectionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(['x', 'y', 'z'] as const).map((axis) => (
                        <SliderField
                          key={axis}
                          label={axis.toUpperCase()}
                          unit="°"
                          value={selected.rotation?.[axis] ?? 0}
                          min={-180}
                          max={180}
                          step={1}
                          onChange={(v) => updateRotation(selected.id, { [axis]: v })}
                        />
                      ))}
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    Spins around its own hanging axis while &ldquo;Reel in&rdquo; is held on the
                    Simulate tab.
                  </div>
                </>
              )}

              {selected.type === 'skirt' && (
                <>
                  <div>
                    <SectionLabel>Color</SectionLabel>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {SKIRT_COLOR_PRESETS.map((preset) => {
                        const active = (selected.skirtColor ?? '#c8342f') === preset.value;
                        return (
                          <button
                            key={preset.value}
                            title={preset.label}
                            onClick={() => updateFeature(selected.id, { skirtColor: preset.value })}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              background: preset.value,
                              border: '2px solid ' + (active ? 'var(--accent)' : 'var(--border-subtle)'),
                              cursor: 'pointer',
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <SliderField
                    label="Strand length"
                    value={selected.skirtLengthMm ?? 40}
                    min={10}
                    max={100}
                    step={1}
                    onChange={(skirtLengthMm) => updateFeature(selected.id, { skirtLengthMm })}
                  />
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-dim)',
            fontSize: 12,
            padding: 20,
            textAlign: 'center',
          }}
        >
          Select a feature to edit its properties
        </div>
      )}
    </div>
  );
}
