import { useRef, useState } from 'react';
import { useProfileStore, type NoseType, type CurveKey, type FillType, type RetrieveAction } from '../../store/useProfileStore';
import { useSegmentsStore } from '../../store/useSegmentsStore';
import { useReferenceImageStore } from '../../store/useReferenceImageStore';
import { useFeatureStore } from '../../store/useFeatureStore';
import { useExportStore } from '../../store/useExportStore';
import AxisCurveEditor from './AxisCurveEditor';
import FinOutlineEditor from '../FinOutlineEditor';
import type { Point2D } from '../../utils/smoothPath';
import { BODY_MATERIAL_LABELS, type BodyMaterial } from '../../utils/materials';

const BODY_MATERIAL_OPTIONS: BodyMaterial[] = ['pla', 'balsa', 'abs', 'polycarbonate', 'pvc'];

type ProfileView = 'top' | 'side' | 'front';

const VIEW_TABS: { id: ProfileView; label: string }[] = [
  { id: 'top', label: 'Top view' },
  { id: 'side', label: 'Side view' },
  { id: 'front', label: 'Front view' },
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
          width: 90,
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

export default function ProfileEditorPanel() {
  const [activeView, setActiveView] = useState<ProfileView>('side');

  // Main body (segment 0).
  const mainLength = useProfileStore((s) => s.length);
  const mainGirth = useProfileStore((s) => s.girth);
  const mainSetLength = useProfileStore((s) => s.setLength);
  const mainSetGirth = useProfileStore((s) => s.setGirth);
  const mainNoseType = useProfileStore((s) => s.noseType);
  const mainSetNoseType = useProfileStore((s) => s.setNoseType);
  const mainSymmetric = useProfileStore((s) => s.symmetric);
  const mainSetSymmetric = useProfileStore((s) => s.setSymmetric);
  const mainFill = useProfileStore((s) => s.fill);
  const mainSetFill = useProfileStore((s) => s.setFill);
  const mainWallThicknessMm = useProfileStore((s) => s.wallThicknessMm);
  const mainSetWallThicknessMm = useProfileStore((s) => s.setWallThicknessMm);
  const mainMaterial = useProfileStore((s) => s.material);
  const mainSetMaterial = useProfileStore((s) => s.setMaterial);
  const mainRetrieveAction = useProfileStore((s) => s.retrieveAction);
  const mainSetRetrieveAction = useProfileStore((s) => s.setRetrieveAction);
  const mainCurves = useProfileStore((s) => s.curves);
  const mainAddPoint = useProfileStore((s) => s.addPoint);
  const mainUpdatePoint = useProfileStore((s) => s.updatePoint);
  const mainDeletePoint = useProfileStore((s) => s.deletePoint);

  // Extra jointed segments.
  const segments = useSegmentsStore((s) => s.segments);
  const activeSegmentId = useSegmentsStore((s) => s.activeId);
  const setActiveSegmentId = useSegmentsStore((s) => s.setActiveId);
  const segSetLength = useSegmentsStore((s) => s.setLength);
  const segSetGirth = useSegmentsStore((s) => s.setGirth);
  const segSetNoseType = useSegmentsStore((s) => s.setNoseType);
  const segSetSymmetric = useSegmentsStore((s) => s.setSymmetric);
  const segSetFill = useSegmentsStore((s) => s.setFill);
  const segSetWallThicknessMm = useSegmentsStore((s) => s.setWallThicknessMm);
  const segSetMaterial = useSegmentsStore((s) => s.setMaterial);
  const segSetRetrieveAction = useSegmentsStore((s) => s.setRetrieveAction);
  const segAddPoint = useSegmentsStore((s) => s.addPoint);
  const segUpdatePoint = useSegmentsStore((s) => s.updatePoint);
  const segDeletePoint = useSegmentsStore((s) => s.deletePoint);

  // Export's print-time wall thickness (perimeter-walls x nozzle-width) is a
  // separately-tunable print setting, but should start out matching the
  // body's own design wall thickness the moment it's marked Hollow, so the
  // two don't start out arbitrarily different.
  const exportNozzleWidthMm = useExportStore((s) => s.nozzleWidthMm);
  const exportSetPerimeterWalls = useExportStore((s) => s.setPerimeterWalls);
  const seedExportWallThickness = (designWallThicknessMm: number) => {
    const walls = Math.round(designWallThicknessMm / Math.max(exportNozzleWidthMm, 0.01));
    exportSetPerimeterWalls(Math.min(6, Math.max(1, walls)));
  };

  const activeSegment = segments.find((s) => s.id === activeSegmentId) ?? null;

  // The "subject" being edited: either the main body or the active extra
  // segment, normalized to the same shape so the rest of the UI doesn't
  // need to branch on which one it is.
  const subject = activeSegment
    ? {
        label: activeSegment.name,
        length: activeSegment.length,
        girth: activeSegment.girth,
        noseType: activeSegment.noseType,
        symmetric: activeSegment.symmetric,
        fill: activeSegment.fill,
        wallThicknessMm: activeSegment.wallThicknessMm,
        material: activeSegment.material,
        retrieveAction: activeSegment.retrieveAction,
        curves: activeSegment.curves,
        setLength: (mm: number) => segSetLength(activeSegment.id, mm),
        setGirth: (mm: number) => segSetGirth(activeSegment.id, mm),
        setNoseType: (t: NoseType) => segSetNoseType(activeSegment.id, t),
        setSymmetric: (v: boolean) => segSetSymmetric(activeSegment.id, v),
        setFill: (f: FillType) => segSetFill(activeSegment.id, f),
        setWallThicknessMm: (mm: number) => segSetWallThicknessMm(activeSegment.id, mm),
        setMaterial: (m: BodyMaterial) => segSetMaterial(activeSegment.id, m),
        setRetrieveAction: (a: RetrieveAction) => segSetRetrieveAction(activeSegment.id, a),
        addPoint: (key: CurveKey, p: Point2D) => segAddPoint(activeSegment.id, key, p),
        updatePoint: (key: CurveKey, i: number, p: Point2D) =>
          segUpdatePoint(activeSegment.id, key, i, p),
        deletePoint: (key: CurveKey, i: number) => segDeletePoint(activeSegment.id, key, i),
      }
    : {
        label: 'Main body',
        length: mainLength,
        girth: mainGirth,
        noseType: mainNoseType,
        symmetric: mainSymmetric,
        fill: mainFill,
        wallThicknessMm: mainWallThicknessMm,
        material: mainMaterial,
        retrieveAction: mainRetrieveAction,
        curves: mainCurves,
        setLength: mainSetLength,
        setGirth: mainSetGirth,
        setNoseType: mainSetNoseType,
        setSymmetric: mainSetSymmetric,
        setFill: (f: FillType) => {
          mainSetFill(f);
          if (f === 'hollow') seedExportWallThickness(mainWallThicknessMm);
        },
        setWallThicknessMm: mainSetWallThicknessMm,
        setMaterial: mainSetMaterial,
        setRetrieveAction: mainSetRetrieveAction,
        addPoint: mainAddPoint,
        updatePoint: mainUpdatePoint,
        deletePoint: mainDeletePoint,
      };

  const refImageUrl = useReferenceImageStore((s) => s.url);
  const refImageX = useReferenceImageStore((s) => s.x);
  const refImageY = useReferenceImageStore((s) => s.y);
  const refImageWidth = useReferenceImageStore((s) => s.width);
  const refImageHeight = useReferenceImageStore((s) => s.height);
  const refImageOpacity = useReferenceImageStore((s) => s.opacity);
  const setRefImage = useReferenceImageStore((s) => s.setImage);
  const setRefTransform = useReferenceImageStore((s) => s.setTransform);
  const clearRefImage = useReferenceImageStore((s) => s.clear);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelected = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const aspect = img.naturalHeight / img.naturalWidth;
        const width = subject.length * 0.8;
        setRefImage(url, width, width * aspect);
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  const side = (key: CurveKey) => ({
    points: subject.curves[key],
    onAdd: (p: Point2D) => subject.addPoint(key, p),
    onUpdate: (i: number, p: Point2D) => subject.updatePoint(key, i, p),
    onDelete: (i: number) => subject.deletePoint(key, i),
    editable: true,
  });

  const features = useFeatureStore((s) => s.features);
  const selectedFeatureId = useFeatureStore((s) => s.selectedId);
  const selectFeature = useFeatureStore((s) => s.selectFeature);
  const addFinPoint = useFeatureStore((s) => s.addFinPoint);
  const updateFinPoint = useFeatureStore((s) => s.updateFinPoint);
  const deleteFinPoint = useFeatureStore((s) => s.deleteFinPoint);

  const selectedFeature = features.find((f) => f.id === selectedFeatureId);

  if (selectedFeature?.type === 'fin') {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-app)',
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Editing outline: <strong style={{ color: 'var(--text-primary)' }}>{selectedFeature.name}</strong>
          </span>
          <ToggleButton label="Back to body" active={false} onClick={() => selectFeature(null)} />
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)' }}>
            Click empty space to add a point &middot; drag to reshape &middot; double-click to delete
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div style={{ width: 'min(100%, 80vh)', height: 'min(100%, 80vh)' }}>
            <FinOutlineEditor
              points={selectedFeature.finOutline ?? []}
              onAdd={(p) => addFinPoint(selectedFeature.id, p)}
              onUpdate={(i, p) => updateFinPoint(selectedFeature.id, i, p)}
              onDelete={(i) => deleteFinPoint(selectedFeature.id, i)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-app)',
        minHeight: 0,
      }}
    >
      {activeSegment && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Editing segment: <strong style={{ color: 'var(--text-primary)' }}>{subject.label}</strong>
          </span>
          <ToggleButton label="Back to main body" active={false} onClick={() => setActiveSegmentId(null)} />
        </div>
      )}

      {/* view tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        {VIEW_TABS.map((tab) => {
          const isActive = tab.id === activeView;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              style={{
                padding: '5px 12px',
                borderRadius: 5,
                border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--border-subtle)'),
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 24,
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          flexWrap: 'wrap',
          rowGap: 12,
        }}
      >
        <NumberField label="Length (mm)" value={subject.length} onChange={subject.setLength} />
        <NumberField label="Girth (mm)" value={subject.girth} onChange={subject.setGirth} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Nose</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['rounded', 'flat'] as NoseType[]).map((type) => (
              <ToggleButton
                key={type}
                label={type === 'rounded' ? 'Rounded' : 'Flat face'}
                active={subject.noseType === type}
                onClick={() => subject.setNoseType(type)}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Symmetry</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <ToggleButton label="On" active={subject.symmetric} onClick={() => subject.setSymmetric(true)} />
            <ToggleButton label="Off" active={!subject.symmetric} onClick={() => subject.setSymmetric(false)} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Fill</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <ToggleButton
              label="Solid"
              active={subject.fill === 'solid'}
              onClick={() => subject.setFill('solid')}
            />
            <ToggleButton
              label="Hollow"
              active={subject.fill === 'hollow'}
              onClick={() => subject.setFill('hollow')}
            />
          </div>
        </div>

        {subject.fill === 'hollow' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Wall thickness (mm)</span>
            <input
              type="number"
              value={Math.round(subject.wallThicknessMm * 10) / 10}
              min={0.1}
              step={0.1}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v) && v > 0) subject.setWallThicknessMm(v);
              }}
              style={{
                width: 90,
                padding: '6px 8px',
                background: 'var(--bg-panel-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 5,
                color: 'var(--text-primary)',
                fontSize: 13,
              }}
            />
          </label>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Material</span>
          <select
            value={subject.material}
            onChange={(e) => subject.setMaterial(e.target.value as BodyMaterial)}
            style={{
              padding: '6px 8px',
              background: 'var(--bg-panel-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 5,
              color: 'var(--text-primary)',
              fontSize: 13,
            }}
          >
            {BODY_MATERIAL_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {BODY_MATERIAL_LABELS[m]}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Retrieve action</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <ToggleButton
              label="None"
              active={subject.retrieveAction === 'none'}
              onClick={() => subject.setRetrieveAction('none')}
            />
            <ToggleButton
              label="Spinning tail"
              active={subject.retrieveAction === 'spinningTail'}
              onClick={() => subject.setRetrieveAction('spinningTail')}
            />
          </div>
          {subject.retrieveAction === 'spinningTail' && (
            <span style={{ fontSize: 11, color: 'var(--text-dim)', maxWidth: 220 }}>
              This part spins continuously around its own length axis while &ldquo;Reel in&rdquo; is
              held on the Simulate tab — for spiral/curly-tail shapes.
            </span>
          )}
        </div>

        {activeView === 'side' && !activeSegment && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Reference photo</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handlePhotoSelected(e.target.files?.[0])}
              />
              <ToggleButton
                label={refImageUrl ? 'Replace' : 'Upload photo'}
                active={false}
                onClick={() => fileInputRef.current?.click()}
              />
              {refImageUrl && (
                <>
                  <ToggleButton label="Remove" active={false} onClick={clearRefImage} />
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={refImageOpacity}
                    onChange={(e) => setRefTransform({ opacity: parseFloat(e.target.value) })}
                    style={{ width: 80 }}
                    title="Photo opacity"
                  />
                </>
              )}
            </div>
          </div>
        )}

        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)', maxWidth: 280 }}>
          {activeView === 'side' && !activeSegment && refImageUrl
            ? 'Scroll to zoom the photo, drag empty space to pan it. Click to add a point, drag a point to reshape, double-click to delete.'
            : 'Click empty space to add a point · drag to reshape · double-click to delete'}
        </div>
      </div>

      {/* curve canvas */}
      <div style={{ flex: 1, minHeight: 0, padding: 8 }}>
        {activeView === 'side' && (
          <AxisCurveEditor
            axisLength={subject.length}
            maxExtent={subject.girth / 2}
            symmetric={subject.symmetric}
            primary={side('side')}
            mirror={side('sideMirror')}
            referenceImage={
              !activeSegment && refImageUrl
                ? {
                    url: refImageUrl,
                    x: refImageX,
                    y: refImageY,
                    width: refImageWidth,
                    height: refImageHeight,
                    opacity: refImageOpacity,
                  }
                : undefined
            }
            onImageTransform={!activeSegment ? setRefTransform : undefined}
          />
        )}
        {activeView === 'top' && (
          <AxisCurveEditor
            axisLength={subject.length}
            maxExtent={subject.girth / 2}
            symmetric={subject.symmetric}
            primary={side('top')}
            mirror={side('topMirror')}
          />
        )}
        {activeView === 'front' && (
          <AxisCurveEditor
            axisLength={subject.girth}
            maxExtent={subject.girth / 2}
            symmetric={subject.symmetric}
            primary={side('front')}
            mirror={side('frontMirror')}
          />
        )}
      </div>
    </div>
  );
}
