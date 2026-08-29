import {
  useFeatureStore,
  type LipShape,
  type LineTieStyle,
} from '../store/useFeatureStore';
import { useProfileStore } from '../store/useProfileStore';
import { useExportStore, type ClearCoat } from '../store/useExportStore';
import { useAppStore } from '../store/useAppStore';
import { BODY_MATERIAL_LABELS } from '../utils/materials';
import Collapsible from './Collapsible';

const LIP_SHAPES: LipShape[] = ['round', 'square', 'coffin'];
const LIP_SHAPE_LABELS: Record<LipShape, string> = { round: 'Round', square: 'Square', coffin: 'Coffin' };
const LINE_TIE_STYLES: LineTieStyle[] = ['ring', 'staple', 'screwEye'];
const LINE_TIE_STYLE_LABELS: Record<LineTieStyle, string> = { ring: 'Ring', staple: 'Staple', screwEye: 'Screw eye' };
const CLEAR_COAT_OPTIONS: ClearCoat[] = ['none', '1coat', '2coat'];
const CLEAR_COAT_LABELS: Record<ClearCoat, string> = { none: 'None', '1coat': '1 coat', '2coat': '2 coats' };

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
            }}
          >
            {labels[opt]}
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

function AxisField({ axis, value, onChange }: { axis: 'x' | 'y' | 'z'; value: number; onChange: (v: number) => void }) {
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

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>{children}</div>;
}

/**
 * Fase F's Simulate-tab Properties panel: an accordion summarizing the
 * pieces that actually matter for how the lure behaves in the tank (Lip,
 * Body, Hooks, Line Tie, Paint & Finish), instead of Editor's per-feature-
 * selection panel (RightSidebar.tsx) — Simulate has no feature selection of
 * its own, so a single always-visible summary reads better here than an
 * empty "select a feature" state.
 */
export default function SimulatePropertiesPanel() {
  const features = useFeatureStore((s) => s.features);
  const updateFeature = useFeatureStore((s) => s.updateFeature);
  const updatePosition = useFeatureStore((s) => s.updatePosition);
  const updateRotation = useFeatureStore((s) => s.updateRotation);

  const lipFeature = features.find((f) => f.type === 'lip');
  const hookFeatures = features.filter((f) => f.type === 'hookHanger');
  const lineTieFeature = features.find((f) => f.type === 'lineTie');

  const length = useProfileStore((s) => s.length);
  const girth = useProfileStore((s) => s.girth);
  const fill = useProfileStore((s) => s.fill);
  const material = useProfileStore((s) => s.material);

  const clearCoat = useExportStore((s) => s.clearCoat);
  const setClearCoat = useExportStore((s) => s.setClearCoat);

  const setActiveTab = useAppStore((s) => s.setActiveTab);

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

      <div style={{ padding: '0 16px 16px' }}>
        <Collapsible label="Lip" defaultOpen={!!lipFeature}>
          {lipFeature ? (
            <>
              <div>
                <SectionLabel>Position (mm)</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {(['x', 'y', 'z'] as const).map((axis) => (
                    <AxisField
                      key={axis}
                      axis={axis}
                      value={lipFeature.position[axis]}
                      onChange={(v) => updatePosition(lipFeature.id, { [axis]: v })}
                    />
                  ))}
                </div>
              </div>

              <div>
                <SectionLabel>Shape</SectionLabel>
                <ChoiceRow
                  options={LIP_SHAPES}
                  value={lipFeature.lipShape ?? 'round'}
                  labels={LIP_SHAPE_LABELS}
                  onChange={(lipShape) => updateFeature(lipFeature.id, { lipShape })}
                />
              </div>

              <SliderField
                label="Angle"
                value={lipFeature.lipAngleDeg ?? 45}
                min={0}
                max={90}
                step={1}
                unit="°"
                onChange={(lipAngleDeg) => updateFeature(lipFeature.id, { lipAngleDeg })}
              />
              <SliderField
                label="Width"
                value={lipFeature.lipWidthMm ?? 14}
                min={4}
                max={Math.max(girth, 10)}
                step={0.5}
                onChange={(lipWidthMm) => updateFeature(lipFeature.id, { lipWidthMm })}
              />
              <SliderField
                label="Length"
                value={lipFeature.lipLengthMm ?? 18}
                min={4}
                max={Math.max(length * 0.4, 10)}
                step={0.5}
                onChange={(lipLengthMm) => updateFeature(lipFeature.id, { lipLengthMm })}
              />

              <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                A steeper angle dives deeper during &ldquo;Reel in&rdquo;. 90° points straight
                down.
              </div>
            </>
          ) : (
            <EmptyState>
              No lip on this lure yet. Add one from the &ldquo;+&rdquo; button in the left
              sidebar to see it dive during &ldquo;Reel in&rdquo;.
            </EmptyState>
          )}
        </Collapsible>

        <Collapsible label="Body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Length</span>
              <span style={{ color: 'var(--text-primary)' }}>{length.toFixed(1)} mm</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Girth</span>
              <span style={{ color: 'var(--text-primary)' }}>{girth.toFixed(1)} mm</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Fill</span>
              <span style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{fill}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Material</span>
              <span style={{ color: 'var(--text-primary)' }}>{BODY_MATERIAL_LABELS[material]}</span>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('editor')}
            style={{
              marginTop: 4,
              padding: '6px 10px',
              borderRadius: 5,
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 11,
              alignSelf: 'flex-start',
            }}
          >
            Edit in Profile Editor →
          </button>
        </Collapsible>

        <Collapsible label="Hooks">
          {hookFeatures.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {hookFeatures.map((hook) => (
                <div key={hook.id} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 }}>{hook.name}</div>
                  Position: {hook.position.x.toFixed(1)}, {hook.position.y.toFixed(1)}, {hook.position.z.toFixed(1)} mm
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No hook hangers on this lure yet.</EmptyState>
          )}
        </Collapsible>

        <Collapsible label="Line Tie">
          {lineTieFeature ? (
            <>
              <div>
                <SectionLabel>Style</SectionLabel>
                <ChoiceRow
                  options={LINE_TIE_STYLES}
                  value={lineTieFeature.lineTieStyle ?? 'ring'}
                  labels={LINE_TIE_STYLE_LABELS}
                  onChange={(lineTieStyle) => updateFeature(lineTieFeature.id, { lineTieStyle })}
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
                      value={lineTieFeature.rotation?.[axis] ?? 0}
                      min={-180}
                      max={180}
                      step={1}
                      onChange={(v) => updateRotation(lineTieFeature.id, { [axis]: v })}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <EmptyState>
              No line tie yet — the fishing line in the tank needs one to attach to.
            </EmptyState>
          )}
        </Collapsible>

        <Collapsible label="Paint & Finish">
          <div>
            <SectionLabel>Clear coat</SectionLabel>
            <ChoiceRow
              options={CLEAR_COAT_OPTIONS}
              value={clearCoat}
              labels={CLEAR_COAT_LABELS}
              onChange={setClearCoat}
            />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Shared with Export's Finish setting — for reference only, not included in the
            weight/buoyancy estimate.
          </div>
        </Collapsible>
      </div>
    </div>
  );
}
