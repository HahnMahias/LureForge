import type { CSSProperties } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { useFeatureStore } from '../store/useFeatureStore';
import { computeTotalWeightG, classifyFloat, type FloatClass, type WaterType } from '../utils/physics';

const LABELS: Record<FloatClass, string> = {
  floats: 'Floats',
  suspends: 'Suspends',
  sinks: 'Sinks',
};

const COLORS: Record<FloatClass, { bg: string; fg: string }> = {
  floats: { bg: '#2f6fd6', fg: '#ffffff' },
  suspends: { bg: '#5a5e68', fg: '#ffffff' },
  sinks: { bg: '#17181b', fg: '#e8e8ea' },
};

const DEFAULT_STYLE: CSSProperties = {
  position: 'absolute',
  bottom: 14,
  left: '50%',
  transform: 'translateX(-50%)',
};

export default function WeightBadge({
  water = 'fresh',
  style,
}: {
  water?: WaterType;
  style?: CSSProperties;
}) {
  const bodyVolumeMm3 = useSceneStore((s) => s.bodyVolumeMm3);
  const bodyWeightG = useSceneStore((s) => s.bodyWeightG);
  const features = useFeatureStore((s) => s.features);

  const totalWeightG = computeTotalWeightG(bodyWeightG, features);
  const floatClass = classifyFloat(totalWeightG, bodyVolumeMm3, water);
  const { bg, fg } = COLORS[floatClass];

  return (
    <div
      style={{
        ...DEFAULT_STYLE,
        ...style,
        background: bg,
        color: fg,
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 999,
        padding: '7px 18px',
        fontSize: 13,
        fontWeight: 600,
        pointerEvents: 'none',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {LABELS[floatClass]} &middot; {totalWeightG.toFixed(1)} g
    </div>
  );
}
