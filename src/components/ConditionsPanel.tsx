import {
  useConditionsStore,
  type LightLevel,
  type CurrentLevel,
  type WindLevel,
} from '../store/useConditionsStore';

const LIGHT_OPTIONS: { value: LightLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'bright', label: 'Bright' },
];
const CURRENT_OPTIONS: { value: CurrentLevel; label: string }[] = [
  { value: 'calm', label: 'Calm' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'strong', label: 'Strong' },
];
const WIND_OPTIONS: { value: WindLevel; label: string }[] = [
  { value: 'calm', label: 'Calm' },
  { value: 'light', label: 'Light' },
  { value: 'strong', label: 'Strong' },
];

function ConditionRow<T extends string>({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{icon}</span>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              style={{
                padding: '4px 8px',
                borderRadius: 5,
                border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border-subtle)'),
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 11,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Fase E's Conditions panel: Light and Current both drive real effects
 * (scene brightness/fog + status-card visibility; a small drift on the
 * passive sink/float physics — see conditionsEffects.ts). Wind is kept
 * purely decorative — see that same file's header for why a closed
 * simulation tank has no physical use for it.
 */
export default function ConditionsPanel() {
  const light = useConditionsStore((s) => s.light);
  const setLight = useConditionsStore((s) => s.setLight);
  const current = useConditionsStore((s) => s.current);
  const setCurrent = useConditionsStore((s) => s.setCurrent);
  const wind = useConditionsStore((s) => s.wind);
  const setWind = useConditionsStore((s) => s.setWind);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
        Conditions
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ConditionRow icon="☀" label="Light" value={light} options={LIGHT_OPTIONS} onChange={setLight} />
        <ConditionRow icon="≋" label="Current" value={current} options={CURRENT_OPTIONS} onChange={setCurrent} />
        <ConditionRow icon="🌬" label="Wind" value={wind} options={WIND_OPTIONS} onChange={setWind} />
      </div>
    </div>
  );
}
