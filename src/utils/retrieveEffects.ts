/**
 * "Retrieve action" motion — a body part's explicit, designer-chosen
 * behavior while Simulate's "Reel in" is held (see useProfileStore's
 * RetrieveAction and ProfileEditorPanel.tsx's Retrieve action ChoiceRow).
 * Currently just the spinning-tail roll rate; kept as a plain function (no
 * React/Three renderer) so it's directly unit-testable, same pattern as
 * lipEffects.ts.
 */

// Roll angular velocity (rad/s) per mm/s of current reel speed — "hoe
// sneller je binnenhaalt, hoe sneller de rotatie."
const SPIN_RAD_PER_MM = 0.03;

export function spinAngularVelocityRadPerS(reelSpeedMmS: number): number {
  return reelSpeedMmS * SPIN_RAD_PER_MM;
}
