/**
 * Fase D's "Action Type" label — a rough, rule-based summary of how a lure
 * behaves on the retrieve, derived from its own configured properties
 * (lip angle, retrieve action, reel speed). Deliberately simple: a handful
 * of if/else branches, not a real classifier — see the redesign brief this
 * was built from ("hoeft geen zware classificatie te zijn").
 */
export interface ActionTypeInputs {
  hasLip: boolean;
  lipAngleDeg: number;
  spinningTail: boolean;
  reelSpeed: number; // the Speed slider's multiplier
}

export function classifyActionType(inputs: ActionTypeInputs): string {
  if (inputs.spinningTail) return 'Spiral Roll';
  if (inputs.hasLip) {
    if (inputs.lipAngleDeg > 60) return 'Steep Dive';
    if (inputs.lipAngleDeg > 20) return 'Steady Dive';
    return 'Subtle Wobble';
  }
  if (inputs.reelSpeed > 2) return 'Sharp Jerk';
  if (inputs.reelSpeed < 0.75) return 'Slow Roll';
  return 'Straight Retrieve';
}

export type WobbleLevel = 'None' | 'Slight' | 'Moderate' | 'Strong';

/** A lip's fixed wobble amplitude only kicks in once one exists — the label scales with how steep it is, matching the same "bigger angle = more action" relationship the dive strength uses. */
export function classifyWobble(hasLip: boolean, lipAngleDeg: number): WobbleLevel {
  if (!hasLip) return 'None';
  if (lipAngleDeg > 60) return 'Strong';
  if (lipAngleDeg > 30) return 'Moderate';
  return 'Slight';
}
