import * as THREE from 'three';
import type { PaintPattern } from '../store/usePaintStore';

export interface PaintColors {
  backColor: string;
  bellyColor: string;
  accentColor: string;
}

export interface PaintPatternPreset extends PaintColors {
  label: string;
}

/**
 * Suggested starting colors per pattern, applied by PaintSidebar.tsx the
 * moment a pattern is picked (still freely overridable afterward via the
 * color swatches/pickers) — chosen to make each pattern immediately read as
 * its real-world namesake instead of requiring the user to also dial in
 * three colors by hand before it looks like anything. The pattern itself
 * doesn't hardcode these; every pattern below just draws with whatever
 * back/belly/accent are currently in the paint store.
 */
export const PAINT_PATTERN_PRESETS: Record<PaintPattern, PaintPatternPreset> = {
  solid: { label: 'Solid', backColor: '#c9b278', bellyColor: '#c9b278', accentColor: '#c9b278' },
  twoTone: { label: 'Two-tone', backColor: '#35404a', bellyColor: '#e7ecef', accentColor: '#35404a' },
  perch: { label: 'Perch', backColor: '#7a8f3a', bellyColor: '#f4e3a1', accentColor: '#1c2a16' },
  firetiger: { label: 'Firetiger', backColor: '#7fd13b', bellyColor: '#ff8c1a', accentColor: '#111111' },
  shad: { label: 'Shad', backColor: '#6f8fa8', bellyColor: '#f2f4f6', accentColor: '#33414c' },
  clown: { label: 'Clown', backColor: '#ff2f92', bellyColor: '#f2ffb0', accentColor: '#ffffff' },
};

export const PAINT_PATTERNS = Object.keys(PAINT_PATTERN_PRESETS) as PaintPattern[];

// The body's own UV layout (generateLureMesh.ts's buildRingTemplate): u runs
// 0 (nose) .. 1 (tail) along the length, v runs belly → back → belly around
// one cross-section ring — so v≈0 AND v≈1 both land on the belly, v≈0.5
// lands on the back/spine. Canvas X maps straight to u (length), canvas Y to
// v, so "belly" is the top AND bottom edge of this canvas and "back" is the
// vertical middle — exactly the layout every pattern below is drawn against.
const TEXTURE_WIDTH = 512;
const TEXTURE_HEIGHT = 256;

/** The classic "dark back, light belly" countershading gradient every pattern but solid is built on. */
function paintCountershading(ctx: CanvasRenderingContext2D, w: number, h: number, back: string, belly: string) {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, belly);
  gradient.addColorStop(0.5, back);
  gradient.addColorStop(1, belly);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

/** Evenly spaced vertical bands (perch/firetiger's "tiger stripes") spanning most of the body's girth but not the belly/back tips. */
function paintVerticalBands(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  count: number,
  bandWidthFrac: number,
  coverFrac: number,
  opacity: number,
) {
  const bandH = h * coverFrac;
  const bandY = (h - bandH) / 2;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const cx = (0.14 + t * 0.72) * w;
    const bw = w * bandWidthFrac;
    ctx.fillRect(cx - bw / 2, bandY, bw, bandH);
  }
  ctx.restore();
}

/** Shad's subtle darker "shoulder" smudge just behind the head (small u, i.e. near the canvas's left edge — see generateLureMesh.ts, u=0 is the nose). */
function paintShoulderPatch(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  const cx = w * 0.16;
  const cy = h * 0.4;
  const r = h * 0.24;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 1.3, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Clown's scattered spots — a small deterministic PRNG (not Math.random) so the same paint settings always render pixel-identical instead of re-jittering on every regenerate. */
function paintScatterDots(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, count: number) {
  let seed = 1337;
  const nextRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = (0.06 + nextRandom() * 0.88) * w;
    const y = (0.08 + nextRandom() * 0.84) * h;
    const r = 2 + nextRandom() * 3.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draws the chosen pattern onto an offscreen canvas and wraps it as a
 * THREE.CanvasTexture, ready to use as a meshStandardMaterial's `map` —
 * see LureBody.tsx's usePaintTexture. Not tileable (ClampToEdgeWrapping,
 * Three's own default): this is a 1:1 map of the whole body, drawn once per
 * pattern/color change, not a repeating surface texture like scaleTexture.ts.
 */
export function createPaintTexture(pattern: PaintPattern, colors: PaintColors): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  const { backColor, bellyColor, accentColor } = colors;
  const w = TEXTURE_WIDTH;
  const h = TEXTURE_HEIGHT;

  switch (pattern) {
    case 'solid':
      ctx.fillStyle = backColor;
      ctx.fillRect(0, 0, w, h);
      break;
    case 'twoTone':
      paintCountershading(ctx, w, h, backColor, bellyColor);
      break;
    case 'perch':
      paintCountershading(ctx, w, h, backColor, bellyColor);
      paintVerticalBands(ctx, w, h, accentColor, 7, 0.035, 0.72, 0.8);
      break;
    case 'firetiger':
      paintCountershading(ctx, w, h, backColor, bellyColor);
      paintVerticalBands(ctx, w, h, accentColor, 6, 0.055, 0.85, 0.9);
      break;
    case 'shad':
      paintCountershading(ctx, w, h, backColor, bellyColor);
      paintShoulderPatch(ctx, w, h, accentColor);
      break;
    case 'clown':
      paintCountershading(ctx, w, h, backColor, bellyColor);
      paintScatterDots(ctx, w, h, accentColor, 90);
      break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
