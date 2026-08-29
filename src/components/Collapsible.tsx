import { useState } from 'react';

/**
 * Shared accordion-section pattern — originally built for ExportPanel.tsx's
 * Advanced settings, now reused by Simulate's Properties panel (Fase F of
 * the visual redesign) so both stay visually and behaviorally consistent.
 */
export default function Collapsible({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: 0,
          marginBottom: open ? 12 : 0,
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
          }}
        >
          {label}
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>}
    </div>
  );
}
