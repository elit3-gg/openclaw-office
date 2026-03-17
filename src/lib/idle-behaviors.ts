/**
 * Idle behavior system — makes agents feel alive and human-like.
 *
 * When an agent is idle at their desk, they occasionally:
 * - Fidget / look around (tiny position shifts)
 * - "Type" (rapid micro-movements)
 * - Stretch (brief stand-up animation)
 * - Turn to face a different direction
 *
 * Each behavior is a time-limited state with smooth transitions.
 */

export type IdleBehavior =
  | "seated"        // Default: sitting at desk, occasional breathing
  | "typing"        // Rapid micro-animation (working)
  | "lookAround"    // Turn to face left/right briefly
  | "stretch"       // Stand up slightly, settle back
  | "sip"           // Lean forward (coffee sip)
  | "think"         // Lean back, pause

export interface IdleBehaviorState {
  current: IdleBehavior;
  timer: number;           // Time remaining in current behavior (seconds)
  cooldown: number;        // Time until next behavior change (seconds)
  offsetX: number;         // Micro position offset X
  offsetY: number;         // Micro position offset Y
  facingDir: number;       // 0=down, 1=left, 2=right, 3=up
  phase: number;           // Animation phase (0-1)
}

// Behavior durations (seconds)
const BEHAVIOR_DURATION: Record<IdleBehavior, [number, number]> = {
  seated:    [3, 8],
  typing:    [2, 6],
  lookAround: [1, 2.5],
  stretch:   [1.5, 3],
  sip:       [1, 2],
  think:     [2, 5],
};

// Weights for random behavior selection (higher = more common)
const BEHAVIOR_WEIGHTS: Record<IdleBehavior, number> = {
  seated:    40,
  typing:    30,
  lookAround: 10,
  stretch:   5,
  sip:       8,
  think:     7,
};

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function weightedRandom(weights: Record<IdleBehavior, number>): IdleBehavior {
  const entries = Object.entries(weights) as [IdleBehavior, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [behavior, weight] of entries) {
    r -= weight;
    if (r <= 0) return behavior;
  }
  return "seated";
}

export function createIdleBehaviorState(): IdleBehaviorState {
  return {
    current: "seated",
    timer: randomRange(2, 5),
    cooldown: 0,
    offsetX: 0,
    offsetY: 0,
    facingDir: 0,
    phase: 0,
  };
}

/**
 * Tick the idle behavior system.
 * Call this every frame with deltaTime in seconds.
 * Returns true if the state changed (for re-rendering).
 */
export function tickIdleBehavior(
  state: IdleBehaviorState,
  dt: number,
  isActive: boolean, // If agent is actively working (thinking/speaking/tool_calling)
): boolean {
  // If agent is active, reset to seated and don't animate idle behaviors
  if (isActive) {
    if (state.current !== "seated") {
      state.current = "seated";
      state.offsetX = 0;
      state.offsetY = 0;
      state.phase = 0;
      state.timer = 1;
      return true;
    }
    return false;
  }

  state.timer -= dt;
  state.phase += dt;

  let changed = false;

  // Animate current behavior
  switch (state.current) {
    case "typing": {
      // Rapid micro-vibration
      state.offsetX = Math.sin(state.phase * 12) * 0.5;
      state.offsetY = Math.sin(state.phase * 8) * 0.3;
      break;
    }
    case "lookAround": {
      // Turn to face a random direction
      const t = state.phase;
      if (t < 0.3) {
        // Turn phase
        state.facingDir = Math.random() > 0.5 ? 1 : 2; // left or right
      } else if (t > 1.5) {
        state.facingDir = 0; // Return to facing down
      }
      break;
    }
    case "stretch": {
      // Slight upward offset then settle
      const t = Math.min(state.phase / 2, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      state.offsetY = -ease * 3;
      break;
    }
    case "sip": {
      // Lean forward
      const t = Math.min(state.phase / 1.5, 1);
      const ease = Math.sin(t * Math.PI);
      state.offsetY = ease * 1.5;
      state.offsetX = ease * 0.5;
      break;
    }
    case "think": {
      // Slow sway
      state.offsetX = Math.sin(state.phase * 0.8) * 1;
      state.offsetY = Math.cos(state.phase * 0.5) * 0.5;
      break;
    }
    case "seated":
    default: {
      // Subtle breathing
      state.offsetY = Math.sin(state.phase * 1.5) * 0.3;
      state.offsetX = 0;
      break;
    }
  }

  // Time to switch behaviors
  if (state.timer <= 0) {
    const prev = state.current;
    state.current = weightedRandom(BEHAVIOR_WEIGHTS);
    const [minDur, maxDur] = BEHAVIOR_DURATION[state.current];
    state.timer = randomRange(minDur, maxDur);
    state.phase = 0;
    state.offsetX = 0;
    state.offsetY = 0;
    changed = prev !== state.current;
  }

  return changed;
}

/**
 * Get the sprite direction override for the current idle behavior.
 * Returns null if no override (use default facing).
 */
export function getIdleFacingDirection(state: IdleBehaviorState): number | null {
  if (state.current === "lookAround") {
    return state.facingDir;
  }
  return null;
}
