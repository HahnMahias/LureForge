import { useMemo, useState } from 'react';
import { useProfileStore } from '../store/useProfileStore';
import { useSegmentsStore } from '../store/useSegmentsStore';
import { useSceneStore } from '../store/useSceneStore';
import { useFeatureStore } from '../store/useFeatureStore';
import {
  useExportStore,
  type Manufacturing,
  type PrintMaterial,
  type ClearCoat,
} from '../store/useExportStore';
import { buildLureGeometry } from '../utils/generateLureMesh';
import { hollowGeometry } from '../utils/meshShell';
import { sliceGeometryAtZ0 } from '../utils/meshSlice';
import { buildStlArrayBuffer, downloadStl } from '../utils/stlExport';
import { computeTotalWeightG, classifyFloat, type FloatClass } from '../utils/physics';
import { WATER_DENSITY_G_CM3 } from '../utils/physics';
import { computeSurfacePlacement } from '../utils/surfacePlacement';
import Collapsible from './Collapsible';

const MANUFACTURING_OPTIONS: Manufacturing[] = ['fdm', 'resin'];
const MANUFACTURING_LABELS: Record<Manufacturing, string> = { fdm: 'FDM', resin: 'Resin' };

// One-click starting points for the print sliders below — the sliders stay
// individually adjustable afterward, this just seeds sensible values instead
// of making every user hand-tune four numbers from scratch.
interface PrintPreset {
  label: string;
  nozzleWidthMm: number;
  layerHeightMm: number;
  perimeterWalls: number;
  infill: number;
}
const PRINT_PRESETS: PrintPreset[] = [
  { label: 'Standard', nozzleWidthMm: 0.4, layerHeightMm: 0.2, perimeterWalls: 3, infill: 20 },
  { label: 'Fine detail', nozzleWidthMm: 0.3, layerHeightMm: 0.1, perimeterWalls: 3, infill: 20 },
  { label: 'Strong', nozzleWidthMm: 0.4, layerHeightMm: 0.24, perimeterWalls: 5, infill: 50 },
];

const FLOAT_LABELS: Record<FloatClass, string> = {
  floats: 'Floats',
  suspends: 'Suspends',
  sinks: 'Sinks',
};

const CLEAR_COAT_OPTIONS: ClearCoat[] = ['none', '1coat', '2coat'];
const CLEAR_COAT_LABELS: Record<ClearCoat, string> = {
  none: 'None',
  '1coat': '1 coat',
  '2coat': '2 coats',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 8 }}>
      {children}
    </div>
  );
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
  step = 1,
  unit = '',
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
          {value}
          {unit}
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

export default function ExportPanel() {
  const curves = useProfileStore((s) => s.curves);
  const length = useProfileStore((s) => s.length);
  const girth = useProfileStore((s) => s.girth);
  const noseType = useProfileStore((s) => s.noseType);
  const symmetric = useProfileStore((s) => s.symmetric);
  const mainFill = useProfileStore((s) => s.fill);
  const mainDesignWallThicknessMm = useProfileStore((s) => s.wallThicknessMm);
  const bodyVolumeMm3 = useSceneStore((s) => s.bodyVolumeMm3);
  const bodyWeightG = useSceneStore((s) => s.bodyWeightG);
  const features = useFeatureStore((s) => s.features);
  const extraSegments = useSegmentsStore((s) => s.segments);

  const manufacturing = useExportStore((s) => s.manufacturing);
  const material = useExportStore((s) => s.material);
  const perimeterWalls = useExportStore((s) => s.perimeterWalls);
  const infill = useExportStore((s) => s.infill);
  const printInTwoHalves = useExportStore((s) => s.printInTwoHalves);
  const nozzleWidthMm = useExportStore((s) => s.nozzleWidthMm);
  const layerHeightMm = useExportStore((s) => s.layerHeightMm);
  const printSpeedMms = useExportStore((s) => s.printSpeedMms);
  const supports = useExportStore((s) => s.supports);
  const clearCoat = useExportStore((s) => s.clearCoat);
  const setManufacturing = useExportStore((s) => s.setManufacturing);
  const setPerimeterWalls = useExportStore((s) => s.setPerimeterWalls);
  const setInfill = useExportStore((s) => s.setInfill);
  const setPrintInTwoHalves = useExportStore((s) => s.setPrintInTwoHalves);
  const setNozzleWidthMm = useExportStore((s) => s.setNozzleWidthMm);
  const setLayerHeightMm = useExportStore((s) => s.setLayerHeightMm);
  const setPrintSpeedMms = useExportStore((s) => s.setPrintSpeedMms);
  const setSupports = useExportStore((s) => s.setSupports);
  const setClearCoat = useExportStore((s) => s.setClearCoat);

  const [exporting, setExporting] = useState(false);

  const isResin = manufacturing === 'resin';

  const applyPreset = (preset: PrintPreset) => {
    setNozzleWidthMm(preset.nozzleWidthMm);
    setLayerHeightMm(preset.layerHeightMm);
    setPerimeterWalls(preset.perimeterWalls);
    setInfill(preset.infill);
  };

  const isMainHollow = mainFill === 'hollow';
  // Export's own print-time shell thickness, from the perimeter-walls/nozzle
  // sliders — a separate, print-tuning number from the body's own design
  // wallThicknessMm (set in the Profile Editor's Fill control), which is
  // what live weight is computed from. They can disagree on the *value*
  // (e.g. thicker walls for a stronger print), but not on *whether* the body
  // is hollow at all — handleExport below only shells a part that's
  // actually marked Hollow.
  const wallThicknessMm = perimeterWalls * nozzleWidthMm;
  const totalWeightG = computeTotalWeightG(bodyWeightG, features);
  const floatClass = classifyFloat(totalWeightG, bodyVolumeMm3);
  const displacedWeightG = (bodyVolumeMm3 / 1000) * WATER_DENSITY_G_CM3.fresh;
  const volumeCm3 = bodyVolumeMm3 / 1000;

  const issues = useMemo(() => {
    const list: string[] = [];
    if (!isMainHollow) return list;
    if (wallThicknessMm <= 0) list.push('Wall thickness must be greater than zero.');
    if (girth / 2 <= wallThicknessMm * 1.5) {
      list.push('Body is thin relative to the wall thickness — try fewer perimeter walls.');
    }

    for (const f of features) {
      if (f.type !== 'ballast') continue;
      const ballastRadius = (f.diameterMm ?? 6) / 2;
      const placement = computeSurfacePlacement(curves, length, symmetric, f.position);
      const outerRadius = Math.sqrt(placement.point.y ** 2 + placement.point.z ** 2);
      const distFromCenter = Math.sqrt(f.position.y ** 2 + f.position.z ** 2);
      const innerWallRadius = outerRadius - wallThicknessMm;
      const clearanceAvailable = innerWallRadius - (distFromCenter + ballastRadius);
      const requiredClearance = f.ballastClearanceMm ?? 1.5;
      if (clearanceAvailable < requiredClearance) {
        list.push(
          `${f.name}: only ${clearanceAvailable.toFixed(1)}mm clearance from the inner wall (need ${requiredClearance}mm).`,
        );
      }
    }

    return list;
  }, [isMainHollow, wallThicknessMm, girth, features, curves, length, symmetric]);

  const handleExport = () => {
    setExporting(true);
    try {
      // Decals (see FeatureMarkers.tsx's DecalMarker) are visual-only —
      // even with "Engraved" fill selected, they're a separate floating
      // mesh, not a boolean cut into the body. Real geometry
      // engraving/embossing would need a CSG library (e.g. three-bvh-csg)
      // this project doesn't have yet. Scales (LureBody.tsx's
      // ScalesOverlay) are likewise a bump-mapped rendering effect only.
      // STL export below only ever uses the plain lofted body geometry, so
      // neither decals nor scales appear in the file.
      const parts = [
        { name: 'lure-body', curves, length, girth, noseType, symmetric, fill: mainFill },
        ...extraSegments.map((seg, i) => ({
          name: `lure-segment-${i + 2}`,
          curves: seg.curves,
          length: seg.length,
          girth: seg.girth,
          noseType: seg.noseType,
          symmetric: seg.symmetric,
          fill: seg.fill,
        })),
      ];

      for (const part of parts) {
        const { geometry } = buildLureGeometry(
          part.curves,
          part.length,
          part.girth,
          part.noseType,
          part.symmetric,
        );
        // Only shell a part that's actually marked Hollow, so the printed
        // file never disagrees with the live weight/buoyancy assumption —
        // a Solid part prints as the plain solid outer geometry.
        const printGeometry = part.fill === 'hollow' ? hollowGeometry(geometry, wallThicknessMm) : geometry;

        if (printInTwoHalves) {
          const { left, right } = sliceGeometryAtZ0(printGeometry);
          downloadStl(`${part.name}-right.stl`, buildStlArrayBuffer(right));
          downloadStl(`${part.name}-left.stl`, buildStlArrayBuffer(left));
        } else {
          downloadStl(`${part.name}.stl`, buildStlArrayBuffer(printGeometry));
        }
      }
    } finally {
      setExporting(false);
    }
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
        Export
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <SectionLabel>Manufacturing</SectionLabel>
          {/* Rendered manually (not via the generic ChoiceRow) so the Resin
              button can carry its own "coming soon" badge visible before
              it's ever selected, not just in a message that only appears
              after clicking it. */}
          <div style={{ display: 'flex', gap: 4 }}>
            {MANUFACTURING_OPTIONS.map((opt) => {
              const active = opt === manufacturing;
              return (
                <button
                  key={opt}
                  onClick={() => setManufacturing(opt)}
                  style={{
                    flex: 1,
                    position: 'relative',
                    padding: '6px 8px',
                    borderRadius: 5,
                    border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border-subtle)'),
                    background: active ? 'var(--accent-dim)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 12,
                  }}
                >
                  {MANUFACTURING_LABELS[opt]}
                  {opt === 'resin' && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 9,
                        fontWeight: 600,
                        letterSpacing: 0.3,
                        textTransform: 'uppercase',
                        color: 'var(--text-dim)',
                        background: 'var(--bg-panel-raised)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 4,
                        padding: '1px 4px',
                        verticalAlign: 'middle',
                      }}
                    >
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {isResin ? (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 6,
              background: 'var(--bg-panel-raised)',
              border: '1px solid var(--border-subtle)',
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: 'var(--text-primary)' }}>Resin printing — coming soon.</strong>{' '}
            Print settings (material, walls, infill, supports) aren&rsquo;t available for resin
            yet. Switch to FDM to configure and export.
          </div>
        ) : (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Material</span>
              <select
                value={material}
                disabled
                onChange={() => {
                  /* only PLA for now */
                }}
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
                <option value={'pla' as PrintMaterial}>PLA</option>
              </select>
            </label>

            <SliderField
              label="Perimeter walls"
              value={perimeterWalls}
              min={1}
              max={6}
              onChange={setPerimeterWalls}
            />

            <SliderField label="Infill" value={infill} min={0} max={100} unit="%" onChange={setInfill} />

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={printInTwoHalves}
                onChange={(e) => setPrintInTwoHalves(e.target.checked)}
              />
              Print in two halves
            </label>
          </>
        )}

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
          <SectionLabel>Validate</SectionLabel>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Buoyancy</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {FLOAT_LABELS[floatClass]} &middot; {totalWeightG.toFixed(1)} g
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Volume</span>
              <span style={{ color: 'var(--text-primary)' }}>{volumeCm3.toFixed(1)} cm&sup3;</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Weight vs. water</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {totalWeightG.toFixed(1)} g / {displacedWeightG.toFixed(1)} g
              </span>
            </div>
            {!isResin && !isMainHollow && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                Body is Solid — it prints solid, no wall thickness or clearance checks apply.
                Switch to Hollow in the Profile Editor to shell it for printing.
              </div>
            )}

            {!isResin && isMainHollow && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Wall thickness</span>
                <span style={{ color: 'var(--text-primary)' }}>{wallThicknessMm.toFixed(2)} mm</span>
              </div>
            )}

            {!isResin && isMainHollow && Math.abs(wallThicknessMm - mainDesignWallThicknessMm) > 0.05 && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                Design wall thickness is {mainDesignWallThicknessMm.toFixed(2)} mm (set in the
                Profile Editor) — print settings above are tuned separately.
              </div>
            )}

            {!isResin && isMainHollow && (
              <div
                style={{
                  marginTop: 4,
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: issues.length === 0 ? 'rgba(47,111,214,0.15)' : 'rgba(229,72,77,0.15)',
                  color: issues.length === 0 ? '#5b9bf0' : '#f2777a',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {issues.length === 0 ? (
                  <span>&#10003; Looks good to print</span>
                ) : (
                  issues.map((issue) => <span key={issue}>&#9888; {issue}</span>)
                )}
              </div>
            )}
          </div>
        </div>

        {!isResin && (
          <div>
            <SectionLabel>Print profile</SectionLabel>
            <div style={{ display: 'flex', gap: 4 }}>
              {PRINT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  title={`Nozzle ${preset.nozzleWidthMm}mm · Layer ${preset.layerHeightMm}mm · ${preset.perimeterWalls} walls · ${preset.infill}% infill`}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: 5,
                    border: '1px solid var(--border-subtle)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginTop: 6 }}>
              Sets walls, infill, nozzle and layer height in one click — each stays individually
              adjustable below afterward.
            </span>
          </div>
        )}

        {!isResin && (
          <Collapsible label="Advanced settings">
            <SliderField
              label="Nozzle width"
              value={nozzleWidthMm}
              min={0.2}
              max={0.8}
              step={0.02}
              unit=" mm"
              onChange={setNozzleWidthMm}
            />
            <SliderField
              label="Layer height"
              value={layerHeightMm}
              min={0.1}
              max={0.3}
              step={0.02}
              unit=" mm"
              onChange={setLayerHeightMm}
            />
            <SliderField
              label="Print speed"
              value={printSpeedMms}
              min={20}
              max={150}
              step={5}
              unit=" mm/s"
              onChange={setPrintSpeedMms}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={supports} onChange={(e) => setSupports(e.target.checked)} />
              Generate supports
            </label>
          </Collapsible>
        )}

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
          <SectionLabel>Finish</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Clear coat</span>
            <ChoiceRow
              options={CLEAR_COAT_OPTIONS}
              value={clearCoat}
              labels={CLEAR_COAT_LABELS}
              onChange={setClearCoat}
            />
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              For reference only — not included in the weight/buoyancy estimate above.
            </span>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting || isResin}
          title={isResin ? 'Resin export is coming soon — switch to FDM to export.' : undefined}
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            border: 'none',
            background: 'var(--accent)',
            color: '#141414',
            fontWeight: 600,
            fontSize: 13,
            cursor: exporting || isResin ? 'default' : 'pointer',
            opacity: exporting || isResin ? 0.5 : 1,
          }}
        >
          {isResin
            ? 'Resin export coming soon'
            : exporting
              ? 'Exporting…'
              : `Export STL${extraSegments.length > 0 ? ` (${extraSegments.length + 1} parts)` : ''}${printInTwoHalves ? ', 2 halves each' : ''}`}
        </button>
      </div>
    </div>
  );
}
