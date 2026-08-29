/**
 * Unit coverage for the spinning-tail roll rate (Fase 3 of the post-audit
 * build plan) — verifies the roll speeds up with reel speed and stops
 * (zero rate) when not reeling.
 */
import { describe, it, expect } from 'vitest';
import { spinAngularVelocityRadPerS } from './retrieveEffects';

describe('spinAngularVelocityRadPerS', () => {
  it('is zero at zero reel speed (i.e. stops the instant reeling stops)', () => {
    expect(spinAngularVelocityRadPerS(0)).toBe(0);
  });

  it('scales linearly with reel speed — faster retrieves spin faster', () => {
    const slow = spinAngularVelocityRadPerS(110);
    const fast = spinAngularVelocityRadPerS(440);
    expect(fast).toBeGreaterThan(slow);
    expect(fast / slow).toBeCloseTo(4, 5);
  });

  it('never spins backwards for a positive reel speed', () => {
    expect(spinAngularVelocityRadPerS(220)).toBeGreaterThan(0);
  });
});
