import * as THREE from 'three';

let baseTexture: THREE.CanvasTexture | null = null;

/**
 * Procedurally draws a tileable fish-scale pattern as a grayscale bump map
 * (no uploaded image asset) — a grid of overlapping scalloped arcs, offset
 * every other row, the classic overlapping-scale look. Extra rows/columns
 * are drawn just past the canvas edges so the pattern repeats seamlessly
 * once wrapped.
 */
function drawScalePattern(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080'; // neutral mid-gray = zero bump
  ctx.fillRect(0, 0, size, size);

  const rows = 6;
  const cols = 6;
  const cellW = size / cols;
  const cellH = size / rows;

  for (let ry = -1; ry <= rows; ry++) {
    for (let rx = -1; rx <= cols; rx++) {
      const offsetX = ((ry % 2) + 2) % 2 === 0 ? 0 : cellW / 2;
      const cx = rx * cellW + offsetX;
      const cy = ry * cellH + cellH * 0.3;
      const radius = cellW * 0.62;

      const gradient = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.7, '#a0a0a0');
      gradient.addColorStop(1, '#808080');

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI, false);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Returns an independent clone (own wrapS/repeat) of the cached base scale
 * texture, so multiple Scales features can each tile it differently without
 * fighting over one shared texture's repeat settings. The expensive canvas
 * drawing only happens once per session.
 */
export function createScaleTexture(): THREE.CanvasTexture {
  if (!baseTexture) baseTexture = drawScalePattern();
  const clone = baseTexture.clone();
  clone.wrapS = THREE.RepeatWrapping;
  clone.wrapT = THREE.RepeatWrapping;
  clone.needsUpdate = true;
  return clone;
}
