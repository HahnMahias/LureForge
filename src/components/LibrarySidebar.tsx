import { useEffect, useMemo, useState } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAppStore } from '../store/useAppStore';
import { LURE_PRESETS } from '../data/lurePresets';

/**
 * Fase G's persistent Library sidebar — a restyle of LibraryView.tsx's own
 * content (search, filter chips, cards), but living alongside the 3D
 * viewport instead of behind a separate full-page tab.
 *
 * This only replaces the left column on the Simulate tab, not everywhere:
 * Editor's own LeftSidebar shows the currently-open lure's own structure
 * (segments, features) — that's essential while editing and has nothing to
 * do with browsing saved lures, so swapping it out there would remove
 * functionality, not just restyle it. Simulate has no such per-feature
 * editing to do, and "which lure am I testing, and can I jump to another
 * one" is exactly what you want handy while testing behavior — so this
 * lives here instead. The full Library tab (LibraryView.tsx) stays too, for
 * a bigger-thumbnail browsing view when that's what's wanted.
 */
export default function LibrarySidebar() {
  const projects = useLibraryStore((s) => s.projects);
  const refreshProjects = useLibraryStore((s) => s.refreshProjects);
  const loadProject = useLibraryStore((s) => s.loadProject);
  const currentProjectId = useLibraryStore((s) => s.currentProjectId);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const typeChips = useMemo(() => {
    const labels = new Set(LURE_PRESETS.filter((p) => p.id !== 'blank').map((p) => p.label));
    return ['All', ...labels];
  }, []);

  const visibleProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesQuery = query.trim() ? p.name.toLowerCase().includes(query.trim().toLowerCase()) : true;
      const matchesType = typeFilter === 'All' ? true : p.lureType === typeFilter;
      return matchesQuery && matchesType;
    });
  }, [projects, query, typeFilter]);

  return (
    <div
      style={{
        width: 260,
        flexShrink: 0,
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            flex: 1,
          }}
        >
          My Lures
        </span>
        <button
          title="New lure"
          onClick={() => setActiveTab('library')}
          style={{
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-subtle)',
            borderRadius: 5,
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 14,
          }}
        >
          +
        </button>
      </div>

      <div style={{ padding: '0 14px 10px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lures..."
          style={{
            width: '100%',
            padding: '7px 10px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-panel-raised)',
            color: 'var(--text-primary)',
            fontSize: 12,
          }}
        />
      </div>

      <div style={{ padding: '0 14px 12px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {typeChips.map((chip) => {
          const active = chip === typeFilter;
          return (
            <button
              key={chip}
              onClick={() => setTypeFilter(chip)}
              style={{
                padding: '4px 8px',
                borderRadius: 999,
                border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border-subtle)'),
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 11,
              }}
            >
              {chip}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleProjects.length === 0 && (
          <div style={{ padding: '12px 4px', fontSize: 11, color: 'var(--text-dim)' }}>
            {projects.length === 0 ? 'No saved lures yet.' : 'No lures match this search/filter.'}
          </div>
        )}
        {visibleProjects.map((project) => {
          const active = project.id === currentProjectId;
          return (
            <button
              key={project.id}
              onClick={() => loadProject(project.id)}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                padding: 8,
                borderRadius: 8,
                border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border-subtle)'),
                background: active ? 'var(--accent-dim)' : 'var(--bg-panel-raised)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 34,
                  flexShrink: 0,
                  borderRadius: 5,
                  background: '#0a0e14',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {project.thumbnail ? (
                  <img src={project.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>No preview</span>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {project.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  {project.lureType ?? 'Custom'} · {project.data.profile.length.toFixed(0)} mm
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ padding: 10, borderTop: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => setActiveTab('library')}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 6,
            border: 'none',
            background: 'var(--accent)',
            color: '#141414',
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          + Create New Lure
        </button>
      </div>
    </div>
  );
}
