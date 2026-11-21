export const EFFECTS_KEY = 'privychka:effects:v1';
export const DEFAULT_EFFECTS = Object.freeze({
  sound:false,
  haptics:false,
  animation:true
});

/** Strict booleans only. Unknown or broken settings never enable surprise audio. */
export function normalizeEffects(value) {
  const source=value && typeof value==='object' && !Array.isArray(value) ? value : {};
  return {
    sound:typeof source.sound==='boolean'?source.sound:DEFAULT_EFFECTS.sound,
    haptics:typeof source.haptics==='boolean'?source.haptics:DEFAULT_EFFECTS.haptics,
    animation:typeof source.animation==='boolean'?source.animation:DEFAULT_EFFECTS.animation
  };
}

/**
 * Pure, testable cue selection. All notes are short original synthesized tones;
 * nothing is downloaded and no music starts without a direct user action.
 */
export function feedbackPlan(settings,character,kind='step',capabilities={}) {
  const prefs=normalizeEffects(settings);
  const milestone=kind==='milestone';
  const calm=character==='bubo';
  const tones=calm
    ? (milestone?[392.00,493.88,587.33]:[392.00,523.25])
    : (milestone?[523.25,659.25,783.99,1046.50]:[523.25,659.25,783.99]);
  return {
    sound:prefs.sound && capabilities.audio===true,
    haptics:prefs.haptics && capabilities.vibrate===true,
    animate:prefs.animation && capabilities.reducedMotion!==true,
    tones,
    waveform:calm?'sine':'triangle',
    vibration:milestone?[20,55,25]:[23],
    milestone
  };
}
