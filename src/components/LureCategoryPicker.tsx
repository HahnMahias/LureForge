import { useRef } from 'react';
import { LURE_CATEGORIES, type LureCategory } from '../data/lureCategories';
import { useCategoryPhotoStore } from '../store/useCategoryPhotoStore';

/**
 * Step 1 of "+ New Lure": pick a category before the existing shape wizard.
 * Purely navigation for now (see data/lureCategories.ts's PREMADE_LURES —
 * every list starts empty), same 2-column card grid style as
 * NewLureWizard's own "Choose a starting shape" step.
 */
export default function LureCategoryPicker({
  onSelect,
  onClose,
}: {
  onSelect: (category: LureCategory) => void;
  onClose: () => void;
}) {
  const photos = useCategoryPhotoStore((s) => s.photos);
  const setPhoto = useCategoryPhotoStore((s) => s.setPhoto);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handlePhotoSelected = (category: LureCategory, file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(category, reader.result as string);
    reader.readAsDataURL(file);
  };

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
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Choose a category</div>
        <button
          onClick={onClose}
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

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 24 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 14,
            maxWidth: 760,
          }}
        >
          {LURE_CATEGORIES.map((category) => {
            const photo = photos[category];
            return (
              <button
                key={category}
                onClick={() => onSelect(category)}
                style={{
                  position: 'relative',
                  height: 120,
                  padding: 0,
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: photo ? undefined : 'var(--bg-panel)',
                  backgroundImage: photo
                    ? `linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.55)), url(${photo})`
                    : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  textAlign: 'left',
                }}
              >
                <input
                  ref={(el) => {
                    fileInputRefs.current[category] = el;
                  }}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handlePhotoSelected(category, e.target.files?.[0])}
                />
                <span
                  role="button"
                  title="Upload a photo for this category"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRefs.current[category]?.click();
                  }}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 5,
                    background: 'rgba(19,19,22,0.75)',
                    color: '#e8e8ea',
                    fontSize: 11,
                  }}
                >
                  🖼
                </span>
                <span
                  style={{
                    position: 'absolute',
                    left: 10,
                    bottom: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: photo ? '#fff' : 'var(--text-primary)',
                    textShadow: photo ? '0 1px 3px rgba(0,0,0,0.6)' : 'none',
                  }}
                >
                  {category}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
