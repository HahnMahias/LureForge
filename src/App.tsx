import { useState } from 'react';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import LibrarySidebar from './components/LibrarySidebar';
import RightSidebar from './components/RightSidebar';
import Viewport3D from './components/Viewport3D';
import SimulateView from './components/SimulateView';
import ExportPanel from './components/ExportPanel';
import SimulatePropertiesPanel from './components/SimulatePropertiesPanel';
import LibraryView from './components/LibraryView';
import ProfileEditorPanel from './components/ProfileEditor/ProfileEditorPanel';
import { useAppStore } from './store/useAppStore';

type CenterMode = '3d' | 'profile';

function App() {
  const activeTab = useAppStore((s) => s.activeTab);
  const [centerMode, setCenterMode] = useState<CenterMode>('3d');

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <TopBar />
      {activeTab === 'library' ? (
        <LibraryView />
      ) : (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Simulate gets the Library-style sidebar (Fase G) instead of the
              structural Segments/Features outline — see LibrarySidebar.tsx's
              own header comment for why only here, not everywhere. */}
          {activeTab === 'simulate' ? <LibrarySidebar /> : <LeftSidebar />}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {activeTab === 'simulate' ? (
              <SimulateView />
            ) : (
              <>
                {activeTab === 'editor' && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 4,
                      padding: '6px 12px',
                      background: 'var(--bg-panel)',
                      borderBottom: '1px solid var(--border-subtle)',
                      flexShrink: 0,
                    }}
                  >
                    {(['profile', '3d'] as CenterMode[]).map((mode) => {
                      const isActive: boolean = centerMode === mode;
                      return (
                        <button
                          key={mode}
                          onClick={() => setCenterMode(mode)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 5,
                            border: 'none',
                            background: isActive ? 'var(--bg-panel-raised)' : 'transparent',
                            color: isActive ? 'var(--text-primary)' : 'var(--text-dim)',
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          {mode === 'profile' ? 'Profile Editor' : '3D View'}
                        </button>
                      );
                    })}
                  </div>
                )}
                {centerMode === 'profile' && activeTab === 'editor' ? (
                  <ProfileEditorPanel />
                ) : (
                  <Viewport3D />
                )}
              </>
            )}
          </div>
          {activeTab === 'export' ? (
            <ExportPanel />
          ) : activeTab === 'simulate' ? (
            <SimulatePropertiesPanel />
          ) : (
            <RightSidebar />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
