import { useState } from 'react';
import { useAppStore, type TabId } from '../store/useAppStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { captureThumbnail } from '../utils/captureThumbnail';

const TABS: { id: TabId; label: string }[] = [
  { id: 'library', label: 'Library' },
  { id: 'editor', label: 'Editor' },
  { id: 'simulate', label: 'Simulate' },
  { id: 'export', label: 'Export' },
];

export default function TopBar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  const currentProjectId = useLibraryStore((s) => s.currentProjectId);
  const currentProjectName = useLibraryStore((s) => s.currentProjectName);
  const setCurrentProjectName = useLibraryStore((s) => s.setCurrentProjectName);
  const saveCurrent = useLibraryStore((s) => s.saveCurrent);
  const getShareableJson = useLibraryStore((s) => s.getShareableJson);
  const [savedFlash, setSavedFlash] = useState(false);
  const [sharedFlash, setSharedFlash] = useState(false);
  // Fase H: purely visual for now — no version history or similar exists
  // yet to switch between, so this intentionally does nothing on click
  // beyond toggling its own open/closed look. Wired up for real once that
  // feature exists.
  const [nameMenuOpen, setNameMenuOpen] = useState(false);

  const handleSave = (asNew: boolean) => {
    const thumbnail = captureThumbnail();
    saveCurrent(thumbnail, asNew);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  };

  const handleShare = async () => {
    const json = getShareableJson();
    try {
      await navigator.clipboard.writeText(json);
      setSharedFlash(true);
      setTimeout(() => setSharedFlash(false), 1200);
    } catch {
      // Clipboard access can be blocked (permissions, insecure context) —
      // fail quietly rather than throwing in the user's face for a
      // deliberately best-effort placeholder feature.
    }
  };

  return (
    <div
      style={{
        height: 48,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 16px',
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: 0.5,
          marginRight: 24,
          color: 'var(--text-primary)',
        }}
      >
        Lure<span style={{ color: 'var(--accent)' }}>Works</span>
      </div>
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              border: 'none',
              background: isActive ? 'var(--accent)' : 'transparent',
              color: isActive ? '#141414' : 'var(--text-secondary)',
              fontWeight: isActive ? 600 : 500,
              fontSize: 13,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {tab.label}
          </button>
        );
      })}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {savedFlash && <span style={{ fontSize: 11, color: 'var(--accent)' }}>Saved</span>}
        {sharedFlash && <span style={{ fontSize: 11, color: 'var(--accent)' }}>Copied</span>}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            value={currentProjectName}
            onChange={(e) => setCurrentProjectName(e.target.value)}
            style={{
              width: 160,
              padding: '6px 26px 6px 10px',
              background: 'var(--bg-panel-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 5,
              color: 'var(--text-primary)',
              fontSize: 12,
            }}
          />
          <button
            onClick={() => setNameMenuOpen((v) => !v)}
            title="More (coming soon)"
            style={{
              position: 'absolute',
              right: 4,
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-dim)',
              fontSize: 10,
            }}
          >
            ▾
          </button>
          {nameMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                padding: '8px 10px',
                background: 'var(--bg-panel-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                fontSize: 11,
                color: 'var(--text-dim)',
                whiteSpace: 'nowrap',
                zIndex: 10,
              }}
            >
              Version history — coming soon
            </div>
          )}
        </div>
        <button
          onClick={handleShare}
          title="Copy this design as JSON"
          style={{
            padding: '6px 12px',
            borderRadius: 5,
            border: '1px solid var(--border-subtle)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Share
        </button>
        <button
          onClick={() => handleSave(false)}
          style={{
            padding: '6px 12px',
            borderRadius: 5,
            border: '1px solid var(--border-subtle)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Save
        </button>
        <button
          onClick={() => handleSave(true)}
          title={currentProjectId ? 'Save as a new project' : 'Save'}
          style={{
            padding: '6px 12px',
            borderRadius: 5,
            border: '1px solid var(--border-subtle)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Save as
        </button>
      </div>
    </div>
  );
}
