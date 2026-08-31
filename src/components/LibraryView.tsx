import { useEffect, useMemo, useState } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAppStore } from '../store/useAppStore';
import NewLureWizard from './NewLureWizard';
import LureCategoryPicker from './LureCategoryPicker';
import { listRecordingsForProject, deleteRecording, type StoredRecording } from '../utils/recordingStorage';
import { LURE_CATEGORY_PRESET_ID, PREMADE_LURES, type LureCategory } from '../data/lureCategories';

type SortOrder = 'name' | 'updated';

/**
 * Fase C — a project card's own recordings list (Simulate's Record button
 * saves clips to IndexedDB tagged with the project id — see
 * utils/recordingStorage.ts). Fetched lazily, only once a card is expanded,
 * rather than eagerly for every project on the page.
 */
function RecordingsPanel({ projectId }: { projectId: string }) {
  const [recordings, setRecordings] = useState<StoredRecording[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listRecordingsForProject(projectId).then((list) => {
      if (!cancelled) setRecordings(list.sort((a, b) => b.createdAt - a.createdAt));
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleDelete = async (id: string) => {
    await deleteRecording(id);
    setRecordings((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        padding: '10px 12px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {recordings === null ? (
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Loading recordings…</span>
      ) : recordings.length === 0 ? (
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          No recordings yet — use Record in the Simulate tab.
        </span>
      ) : (
        recordings.map((rec) => (
          <div key={rec.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <video
              controls
              src={URL.createObjectURL(rec.blob)}
              style={{ width: '100%', borderRadius: 4, background: '#000' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {new Date(rec.createdAt).toLocaleString()}
              </span>
              <button
                onClick={() => handleDelete(rec.id)}
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid var(--border-subtle)',
                  background: 'transparent',
                  color: 'var(--text-dim)',
                  fontSize: 10,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function LibraryView() {
  const projects = useLibraryStore((s) => s.projects);
  const refreshProjects = useLibraryStore((s) => s.refreshProjects);
  const loadProject = useLibraryStore((s) => s.loadProject);
  const deleteProject = useLibraryStore((s) => s.deleteProject);
  const duplicateProject = useLibraryStore((s) => s.duplicateProject);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  // "+ New Lure" now opens the category catalog first (Fase H) rather than
  // jumping straight to the shape wizard — 'categories' -> 'category' (one
  // category's premade list, currently always empty) -> 'wizard'.
  const [newLureFlow, setNewLureFlow] = useState<'closed' | 'categories' | 'category' | 'wizard'>('closed');
  const [selectedCategory, setSelectedCategory] = useState<LureCategory | null>(null);
  const [query, setQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('updated');
  const [expandedRecordingsId, setExpandedRecordingsId] = useState<string | null>(null);

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

  const closeNewLureFlow = () => {
    setNewLureFlow('closed');
    setSelectedCategory(null);
  };

  if (newLureFlow === 'categories') {
    return (
      <LureCategoryPicker
        onClose={closeNewLureFlow}
        onSelect={(category) => {
          setSelectedCategory(category);
          setNewLureFlow('category');
        }}
      />
    );
  }

  if (newLureFlow === 'category' && selectedCategory) {
    const premade = PREMADE_LURES[selectedCategory];
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
          <button
            onClick={() => setNewLureFlow('categories')}
            style={{
              padding: '5px 12px',
              borderRadius: 5,
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 12,
            }}
          >
            &larr; Categories
          </button>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedCategory}</div>
          <button
            onClick={closeNewLureFlow}
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

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {premade.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360 }}>
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                No premade lures in {selectedCategory} yet.
              </div>
              <button
                onClick={() => setNewLureFlow('wizard')}
                style={{
                  alignSelf: 'flex-start',
                  padding: '10px 18px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#141414',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Start blank in this category
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {/* Future: click a card to load its ProjectData, same
                  applyProjectData pattern useLibraryStore.loadProject uses. */}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (newLureFlow === 'wizard') {
    return (
      <NewLureWizard
        onClose={closeNewLureFlow}
        initialPresetId={selectedCategory ? LURE_CATEGORY_PRESET_ID[selectedCategory] : undefined}
        categoryOverride={selectedCategory ?? undefined}
      />
    );
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
          onClick={() => setNewLureFlow('categories')}
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
                      setExpandedRecordingsId((id) => (id === project.id ? null : project.id));
                    }}
                    title="Recordings"
                    style={{
                      width: 20,
                      height: 20,
                      border: 'none',
                      background: 'transparent',
                      color: expandedRecordingsId === project.id ? 'var(--accent)' : 'var(--text-dim)',
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >
                    ▶
                  </button>
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
            {expandedRecordingsId === project.id && <RecordingsPanel projectId={project.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}
