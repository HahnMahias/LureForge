import { useMemo, useState } from 'react';
import AxisCurveEditor from './ProfileEditor/AxisCurveEditor';
import { useAppStore } from '../store/useAppStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useProfileStore, type CurveKey, type NoseType } from '../store/useProfileStore';
import { useSegmentsStore } from '../store/useSegmentsStore';
import { useFeatureStore } from '../store/useFeatureStore';
import { useReferenceImageStore } from '../store/useReferenceImageStore';
import { LURE_PRESETS, buildPresetCurves, type LurePreset } from '../data/lurePresets';
import type { Point2D } from '../utils/smoothPath';

type Step = 'type' | 'side' | 'top' | 'front' | 'confirm';
const STEPS: { id: Step; label: string }[] = [
  { id: 'type', label: 'Type' },
  { id: 'side', label: 'Side view' },
  { id: 'top', label: 'Top view' },
  { id: 'front', label: 'Front view' },
  { id: 'confirm', label: 'Confirm' },
];

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <input
        type="number"
        value={Math.round(value * 10) / 10}
        min={1}
        step={1}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v) && v > 0) onChange(v);
        }}
        style={{
          width: 100,
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

function ToggleButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 5,
        border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border-subtle)'),
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 12,
      }}
    >
      {label}
    </button>
  );
}

export default function NewLureWizard({
  onClose,
  initialPresetId,
  categoryOverride,
}: {
  onClose: () => void;
  // Set when arriving from LureCategoryPicker's "Start blank in this
  // category" — preselects the closest-matching preset (see
  // data/lureCategories.ts's LURE_CATEGORY_PRESET_ID) instead of always
  // starting on the first preset in the list.
  initialPresetId?: string;
  // Tags the created lure with the catalog category instead of the shape
  // preset's own label (e.g. "Poppers" instead of "Popper") when set.
  categoryOverride?: string;
}) {
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  const [step, setStep] = useState<Step>('type');
  const [presetId, setPresetId] = useState<string>(initialPresetId ?? LURE_PRESETS[0].id);
  const preset = useMemo<LurePreset>(
    () => LURE_PRESETS.find((p) => p.id === presetId) ?? LURE_PRESETS[0],
    [presetId],
  );

  const [length, setLength] = useState(preset.length);
  const [girth, setGirth] = useState(preset.girth);
  const [noseType, setNoseType] = useState<NoseType>(preset.noseType);
  const [name, setName] = useState(preset.label);
  const [touchedNoseType, setTouchedNoseType] = useState(false);
  const [touchedName, setTouchedName] = useState(false);

  // The draft curves regenerate from the preset shape whenever type/length/
  // girth change, UNLESS the user already hand-edited a curve on one of the
  // Side/Top/Front steps — then that manual edit wins.
  const [curves, setCurves] = useState<Record<CurveKey, Point2D[]>>(() =>
    buildPresetCurves(preset, preset.length, preset.girth),
  );
  const [dirtyKeys, setDirtyKeys] = useState<Set<CurveKey>>(new Set());

  const applyPreset = (next: LurePreset, nextLength: number, nextGirth: number) => {
    const fresh = buildPresetCurves(next, nextLength, nextGirth);
    setCurves((prev) => {
      const merged = { ...fresh };
      for (const key of dirtyKeys) merged[key] = prev[key];
      return merged;
    });
  };

  const handlePresetSelect = (id: string) => {
    const next = LURE_PRESETS.find((p) => p.id === id) ?? LURE_PRESETS[0];
    setPresetId(id);
    setLength(next.length);
    setGirth(next.girth);
    if (!touchedNoseType) setNoseType(next.noseType);
    if (!touchedName) setName(next.label);
    setDirtyKeys(new Set());
    applyPreset(next, next.length, next.girth);
  };

  const handleLengthChange = (mm: number) => {
    setLength(mm);
    applyPreset(preset, mm, girth);
  };

  const handleGirthChange = (mm: number) => {
    setGirth(mm);
    applyPreset(preset, length, mm);
  };

  const curveHandlers = (key: CurveKey) => ({
    points: curves[key],
    onAdd: (p: Point2D) => {
      setDirtyKeys((prev) => new Set(prev).add(key));
      setCurves((prev) => ({ ...prev, [key]: [...prev[key], p].sort((a, b) => a.x - b.x) }));
    },
    onUpdate: (i: number, p: Point2D) => {
      setDirtyKeys((prev) => new Set(prev).add(key));
      setCurves((prev) => {
        const pts = [...prev[key]];
        pts[i] = p;
        return { ...prev, [key]: pts };
      });
    },
    onDelete: (i: number) => {
      setCurves((prev) => {
        if (prev[key].length <= 3) return prev;
        return { ...prev, [key]: prev[key].filter((_, idx) => idx !== i) };
      });
    },
    editable: true,
  });

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const goNext = () => setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)].id);
  const goBack = () => setStep(STEPS[Math.max(stepIndex - 1, 0)].id);

  const handleCreate = () => {
    // Reset every profile field, not just the wizard's own inputs — without
    // this, a brand-new lure silently inherited whatever Fill/Material/
    // Retrieve action the previously open project happened to be left on.
    useProfileStore.setState({
      length,
      girth,
      noseType,
      symmetric: true,
      curves,
      fill: 'solid',
      wallThicknessMm: 2,
      material: 'pla',
      retrieveAction: 'none',
    });
    useSegmentsStore.setState({ segments: [], activeId: null });
    useFeatureStore.setState({ features: [], selectedId: null });
    useReferenceImageStore.getState().clear();
    useLibraryStore.setState({
      currentProjectId: null,
      currentProjectName: name.trim() || preset.label,
      // Tags this lure with its starting preset (Jerkbait, Minnow, ...) so
      // Fase G's Library sidebar can filter by type later — "Blank" isn't a
      // real lure type, so it's tagged as "Custom" like a from-scratch design.
      currentLureType: categoryOverride ?? (preset.id === 'blank' ? 'Custom' : preset.label),
    });
    setActiveTab('editor');
    onClose();
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-app)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 4 }}>
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 5,
                fontSize: 12,
                fontWeight: 500,
                color: i === stepIndex ? 'var(--text-primary)' : 'var(--text-dim)',
                background: i === stepIndex ? 'var(--accent-dim)' : 'transparent',
                border: '1px solid ' + (i === stepIndex ? 'var(--accent)' : 'transparent'),
              }}
            >
              <span>{i + 1}.</span>
              {s.label}
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          style={{
            marginLeft: 'auto',
            padding: '5px 12px',
            borderRadius: 5,
            border: '1px solid var(--border-subtle)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 12,
          }}
        >
          Cancel
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 24 }}>
        {step === 'type' && (
          <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                Choose a starting shape
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {LURE_PRESETS.map((p) => {
                  const active = p.id === presetId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handlePresetSelect(p.id)}
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        borderRadius: 8,
                        border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border-subtle)'),
                        background: active ? 'var(--accent-dim)' : 'var(--bg-panel)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{p.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <NumberField label="Length (mm)" value={length} onChange={handleLengthChange} />
              <NumberField label="Girth (mm)" value={girth} onChange={handleGirthChange} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Nose</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['rounded', 'flat'] as NoseType[]).map((t) => (
                    <ToggleButton
                      key={t}
                      label={t === 'rounded' ? 'Rounded' : 'Flat face'}
                      active={noseType === t}
                      onClick={() => {
                        setTouchedNoseType(true);
                        setNoseType(t);
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, maxWidth: 280 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Lure name</span>
              <input
                value={name}
                onChange={(e) => {
                  setTouchedName(true);
                  setName(e.target.value);
                }}
                style={{
                  padding: '8px 10px',
                  background: 'var(--bg-panel-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 5,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                }}
              />
            </label>
          </div>
        )}

        {step === 'side' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              Click empty space to add a point &middot; drag to reshape &middot; double-click to delete
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <AxisCurveEditor
                axisLength={length}
                maxExtent={girth / 2}
                symmetric
                primary={curveHandlers('side')}
                mirror={curveHandlers('sideMirror')}
              />
            </div>
          </div>
        )}

        {step === 'top' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              Click empty space to add a point &middot; drag to reshape &middot; double-click to delete
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <AxisCurveEditor
                axisLength={length}
                maxExtent={girth / 2}
                symmetric
                primary={curveHandlers('top')}
                mirror={curveHandlers('topMirror')}
              />
            </div>
          </div>
        )}

        {step === 'front' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              Click empty space to add a point &middot; drag to reshape &middot; double-click to delete
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <AxisCurveEditor
                axisLength={girth}
                maxExtent={girth / 2}
                symmetric
                primary={curveHandlers('front')}
                mirror={curveHandlers('frontMirror')}
              />
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Ready to create</div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontSize: 12,
                padding: 14,
                borderRadius: 8,
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Name</span>
                <span style={{ color: 'var(--text-primary)' }}>{name.trim() || preset.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Type</span>
                <span style={{ color: 'var(--text-primary)' }}>{preset.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Length &times; Girth</span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {length} mm &times; {girth} mm
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Nose</span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {noseType === 'rounded' ? 'Rounded' : 'Flat face'}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              This replaces the currently open lure in the Editor with a new one. Any unsaved
              changes to the lure you had open will be lost unless you saved it first.
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={goBack}
          disabled={stepIndex === 0}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 13,
            opacity: stepIndex === 0 ? 0.4 : 1,
          }}
        >
          Back
        </button>
        <div style={{ marginLeft: 'auto' }}>
          {step === 'confirm' ? (
            <button
              onClick={handleCreate}
              style={{
                padding: '10px 18px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--accent)',
                color: '#141414',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Create lure
            </button>
          ) : (
            <button
              onClick={goNext}
              style={{
                padding: '10px 18px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--accent)',
                color: '#141414',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
