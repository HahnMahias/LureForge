import { describe, it, expect } from 'vitest';
import { classifyActionType, classifyWobble } from './swimmingAction';

describe('classifyActionType', () => {
  it('prioritizes spinning tail over everything else', () => {
    expect(
      classifyActionType({ hasLip: true, lipAngleDeg: 80, spinningTail: true, reelSpeed: 3 }),
    ).toBe('Spiral Roll');
  });

  it('a steep lip reads as a steep dive', () => {
    expect(classifyActionType({ hasLip: true, lipAngleDeg: 75, spinningTail: false, reelSpeed: 1 })).toBe(
      'Steep Dive',
    );
  });

  it('a shallow lip reads as a subtle wobble', () => {
    expect(classifyActionType({ hasLip: true, lipAngleDeg: 5, spinningTail: false, reelSpeed: 1 })).toBe(
      'Subtle Wobble',
    );
  });

  it('no lip, fast reeling reads as a sharp jerk', () => {
    expect(classifyActionType({ hasLip: false, lipAngleDeg: 0, spinningTail: false, reelSpeed: 3 })).toBe(
      'Sharp Jerk',
    );
  });

  it('no lip, slow reeling reads as a slow roll', () => {
    expect(classifyActionType({ hasLip: false, lipAngleDeg: 0, spinningTail: false, reelSpeed: 0.5 })).toBe(
      'Slow Roll',
    );
  });
});

describe('classifyWobble', () => {
  it('is None without a lip regardless of angle', () => {
    expect(classifyWobble(false, 80)).toBe('None');
  });

  it('scales with lip angle when a lip is present', () => {
    expect(classifyWobble(true, 10)).toBe('Slight');
    expect(classifyWobble(true, 45)).toBe('Moderate');
    expect(classifyWobble(true, 85)).toBe('Strong');
  });
});
