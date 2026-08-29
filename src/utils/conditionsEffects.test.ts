import { describe, it, expect } from 'vitest';
import { lightBrightness, visibilityForLight, currentDriftMmPerS } from './conditionsEffects';

describe('lightBrightness', () => {
  it('increases monotonically from low to bright', () => {
    expect(lightBrightness('low')).toBeLessThan(lightBrightness('moderate'));
    expect(lightBrightness('moderate')).toBeLessThan(lightBrightness('bright'));
  });
});

describe('visibilityForLight', () => {
  it('less light means lower visibility', () => {
    expect(visibilityForLight('low')).toBeLessThan(visibilityForLight('moderate'));
    expect(visibilityForLight('moderate')).toBeLessThan(visibilityForLight('bright'));
  });
});

describe('currentDriftMmPerS', () => {
  it('is exactly zero for calm current regardless of weight', () => {
    expect(currentDriftMmPerS('calm', 5)).toBe(0);
    expect(currentDriftMmPerS('calm', 200)).toBe(0);
  });

  it('a lighter lure drifts more than a heavier one at the same current level', () => {
    const light = currentDriftMmPerS('moderate', 3);
    const heavy = currentDriftMmPerS('moderate', 80);
    expect(light).toBeGreaterThan(heavy);
  });

  it('stronger current drifts more than moderate, for the same weight', () => {
    expect(currentDriftMmPerS('strong', 20)).toBeGreaterThan(currentDriftMmPerS('moderate', 20));
  });

  it('never goes negative or unbounded for an extreme (near-zero) weight', () => {
    const drift = currentDriftMmPerS('strong', 0.01);
    expect(drift).toBeGreaterThan(0);
    expect(Number.isFinite(drift)).toBe(true);
  });
});
