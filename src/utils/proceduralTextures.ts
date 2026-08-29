import * as THREE from 'three';

/**
 * Small offscreen-canvas textures for the Simulate tank's underwater
 * atmosphere (Fase A) — cheap procedural stand-ins for what would otherwise
 * need baked photo panoramas, kept deliberately tiny (a gradient/noise
 * pattern doesn't need resolution) so they cost almost nothing to generate
 * or upload to the GPU.
 */

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

/**
 * A vertical sky-to-depth gradient for the scene background — brighter
 * blue-green near the water surface (top), fading to a dark navy toward the
 * depths (bottom). `brightness` (0..1) scales how light the top stop is,
 * used by Fase E's Light condition.
 */
export function createUnderwaterGradientTexture(brightness = 0.7): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(2, 256);
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  const topL = 0.18 + brightness * 0.22;
  const midL = 0.09 + brightness * 0.12;
  gradient.addColorStop(0, `hsl(190, 65%, ${topL * 100}%)`);
  gradient.addColorStop(0.45, `hsl(200, 60%, ${midL * 100}%)`);
  gradient.addColorStop(1, `hsl(215, 55%, ${(0.03 + brightness * 0.03) * 100}%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Fog color that matches the gradient's mid-tone, so distant geometry fades into the background instead of a mismatched flat color. */
export function underwaterFogColor(brightness = 0.7): THREE.Color {
  const midL = 0.09 + brightness * 0.12;
  return new THREE.Color(`hsl(200, 60%, ${midL * 100}%)`);
}

/** A soft radial-falloff dot, used as the sprite for the drifting particle field. */
export function createSoftDotTexture(): THREE.CanvasTexture {
  const size = 32;
  const { canvas, ctx } = makeCanvas(size, size);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/** A vertical gradient strip (opaque at one end, transparent at the other) used to fade a god-ray plane/cone toward nothing. */
export function createRayFadeTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(4, 128);
  const gradient = ctx.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(canvas);
}

/**
 * A speckled sand/gravel-like noise texture for the tank floor — plain
 * per-pixel random noise in a narrow sand hue range reads as "grainy sand"
 * at the tiling scale a tank floor is viewed at, without needing a real
 * photographic texture.
 */
export function createSandTexture(): THREE.CanvasTexture {
  const size = 128;
  const { canvas, ctx } = makeCanvas(size, size);
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const n = 0.55 + Math.random() * 0.3;
    const r = 196 * n;
    const g = 178 * n;
    const b = 140 * n;
    image.data[i * 4] = r;
    image.data[i * 4 + 1] = g;
    image.data[i * 4 + 2] = b;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
