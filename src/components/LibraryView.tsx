import { useEffect, useMemo, useState } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAppStore } from '../store/useAppStore';
import NewLureWizard from './NewLureWizard';

type SortOrder = 'name' | 'updated';

export default function LibraryView() {
  const projects = useLibraryStore((s) => s.projects);
  const refreshProjects = useLibraryStore((s) => s.refreshProjects);
  const loadProject = useLibraryStore((s) => s.loadProject);
  const deleteProject = useLibraryStore((s) => s.deleteProject);
  const duplicateProject = useLibraryStore((s) => s.duplicateProject);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const [showWizard, setShowWizard] = useState(false);
  const [query, setQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('updated');

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const handleOpen = (id: string) => {
    loadProject(id);
    setActiveTab('editor');
  };

  // listProjects() already returns updatedAt-desc, so that's a no-op sort
  // here; only the name case needs an actual re-sort of the filtered list.
  const visibleProjects = useMemo(() => {
    const filtered = query.trim()
      ? projects.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
      : projects;
    if (sortOrder === 'name') {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }
    return filtered;
  }, [projects, query, sortOrder]);

  if (showWizard) {
    return <NewLureWizard onClose={() => setShowWizard(false)} />;
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: 'var(--bg-app)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {projects.length === 0
            ? 'No saved projects yet. Use "Save" in the top bar while editing to add one here.'
            : `${projects.length} saved project${projects.length === 1 ? '' : 's'}`}
        </div>

        {projects.length > 0 && (
          <>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name"
              style={{
                padding: '7px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-panel-raised)',
                color: 'var(--text-primary)',
                fontSize: 12,
                width: 180,
              }}
            />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              style={{
                padding: '7px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-panel-raised)',
                color: 'var(--text-primary)',
                fontSize: 12,
              }}
            >
              <option value="updated">Last modified</option>
              <option value="name">Name</option>
            </select>
          </>
        )}

        <button
          onClick={() => setShowWizard(true)}
          style={{
            marginLeft: 'auto',
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            background: 'var(--accent)',
            color: '#141414',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          + New Lure
        </button>
      </div>

      {projects.length > 0 && visibleProjects.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-dim)', padding: '12px 0' }}>
          No projects match &ldquo;{query}&rdquo;.
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        {visibleProjects.map((project) => (
          <div
            key={project.id}
            onClick={() => handleOpen(project.id)}
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              overflow: 'hidden',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                aspectRatio: '4 / 3',
                background: 'var(--bg-panel-raised)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {project.thumbnail ? (
                <img
                  src={project.thumbnail}
                  alt={project.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>No preview</span>
              )}
            </div>
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {project.name}
                </span>
                <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateProject(project.id);
                    }}
                    title="Duplicate"
                    style={{
                      width: 20,
                      height: 20,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-dim)',
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >
                    ⧉
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProject(project.id);
                    }}
                    title="Delete"
                    style={{
                      width: 20,
                      height: 20,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-dim)',
                      borderRadius: 4,
                      fontSize: 13,
                    }}
                  >
                    ×
                  </button>
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {new Date(project.updatedAt).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
