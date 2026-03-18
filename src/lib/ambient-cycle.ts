/**
 * Day/Night Ambient Cycle System
 * 
 * Creates a compressed day cycle where 1 real minute = ~1 office hour.
 * This makes the office feel alive with changing activity levels throughout the "day".
 * 
 * Schedule (office hours):
 * - 8:00-12:00 (Morning): Bright, busy, lots of activities
 * - 12:00-13:00 (Lunch): Most agents leave, quieter
 * - 13:00-17:00 (Afternoon): Active but calmer
 * - 17:00-19:00 (Evening): Agents start "leaving" (fade out one by one)
 * - 19:00-20:00 (Night): Lights dim, only 1-2 agents working late
 * - 20:00-8:00 (After hours): Very dim, rare activity
 */

// ── Time Scale ──
// 1 real minute = 1 office hour
// So 12 real minutes = full 12-hour day cycle (8am - 8pm)
const REAL_MS_PER_OFFICE_HOUR = 60 * 1000; // 60 seconds per office hour
const OFFICE_DAY_START = 8; // 8:00 AM
// OFFICE_DAY_END = 20 (8:00 PM) - used implicitly in logic

// ── Singleton State ──
let cycleStartTime: number = Date.now();
let isPaused: boolean = false;
let pausedHour: number = 9; // Default start at 9 AM

// ── Time Calculation ──

/**
 * Get the current office hour (8-20 for daytime, 20-8 for night).
 * Returns a decimal hour, e.g., 9.5 = 9:30 AM
 */
export function getOfficeHour(): number {
  if (isPaused) return pausedHour;
  
  const elapsedMs = Date.now() - cycleStartTime;
  const elapsedHours = elapsedMs / REAL_MS_PER_OFFICE_HOUR;
  
  // Cycle through 24 hours (but we mainly care about 8-20)
  const hourOfDay = (OFFICE_DAY_START + elapsedHours) % 24;
  
  return hourOfDay;
}

/**
 * Get a formatted time string (e.g., "9:30 AM")
 */
export function getFormattedTime(): string {
  const hour = getOfficeHour();
  const hourInt = Math.floor(hour);
  const minutes = Math.floor((hour - hourInt) * 60);
  const period = hourInt >= 12 ? "PM" : "AM";
  const displayHour = hourInt > 12 ? hourInt - 12 : hourInt === 0 ? 12 : hourInt;
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
}

/**
 * Get the current period of the day.
 */
export type DayPeriod = "morning" | "lunch" | "afternoon" | "evening" | "night" | "afterHours";

export function getDayPeriod(): DayPeriod {
  const hour = getOfficeHour();
  
  if (hour >= 8 && hour < 12) return "morning";
  if (hour >= 12 && hour < 13) return "lunch";
  if (hour >= 13 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 19) return "evening";
  if (hour >= 19 && hour < 20) return "night";
  return "afterHours";
}

// ── Activity Multiplier ──

/**
 * Get the activity multiplier based on time of day.
 * This controls how many activities trigger and how active the office feels.
 * 
 * Returns 0.0 - 1.5:
 * - Morning: 1.2-1.5 (very active)
 * - Lunch: 0.3 (quiet)
 * - Afternoon: 0.8-1.0 (moderate)
 * - Evening: 0.4-0.6 (winding down)
 * - Night: 0.2-0.3 (very quiet)
 * - After hours: 0.1 (minimal)
 */
export function getActivityMultiplier(): number {
  const hour = getOfficeHour();
  
  // Morning ramp-up (8-10): 1.0 -> 1.5
  if (hour >= 8 && hour < 10) {
    const progress = (hour - 8) / 2;
    return 1.0 + progress * 0.5;
  }
  
  // Morning peak (10-12): 1.5
  if (hour >= 10 && hour < 12) {
    return 1.5;
  }
  
  // Lunch dip (12-13): 0.3
  if (hour >= 12 && hour < 13) {
    return 0.3;
  }
  
  // Afternoon (13-17): 0.8 -> 1.0 -> 0.8
  if (hour >= 13 && hour < 17) {
    const progress = (hour - 13) / 4;
    // Peak at 15:00 (3 PM)
    const peakFactor = 1 - Math.abs(progress - 0.5) * 2;
    return 0.8 + peakFactor * 0.2;
  }
  
  // Evening wind-down (17-19): 0.6 -> 0.3
  if (hour >= 17 && hour < 19) {
    const progress = (hour - 17) / 2;
    return 0.6 - progress * 0.3;
  }
  
  // Night (19-20): 0.2
  if (hour >= 19 && hour < 20) {
    return 0.2;
  }
  
  // After hours (20-8): 0.1
  return 0.1;
}

// ── Lighting Parameters ──

export interface LightingParams {
  ambientIntensity: number;      // 0.0 - 1.0
  ambientColor: { r: number; g: number; b: number };
  mainLightIntensity: number;    // 0.0 - 1.5
  mainLightColor: { r: number; g: number; b: number };
  warmth: number;                // 0.0 = cool, 1.0 = warm
  particleDensity: number;       // 0.0 - 1.0
  ceilingLightsOn: boolean;
}

/**
 * Get lighting parameters based on time of day.
 */
export function getLightingParams(): LightingParams {
  const hour = getOfficeHour();
  const period = getDayPeriod();
  
  switch (period) {
    case "morning":
      // Bright, slightly cool morning light
      return {
        ambientIntensity: 0.4 + (hour - 8) * 0.05,
        ambientColor: { r: 0.95, g: 0.95, b: 1.0 },
        mainLightIntensity: 1.0 + (hour - 8) * 0.1,
        mainLightColor: { r: 1.0, g: 0.98, b: 0.95 },
        warmth: 0.3,
        particleDensity: 0.8,
        ceilingLightsOn: true,
      };
      
    case "lunch":
      // Peak brightness
      return {
        ambientIntensity: 0.6,
        ambientColor: { r: 1.0, g: 1.0, b: 1.0 },
        mainLightIntensity: 1.3,
        mainLightColor: { r: 1.0, g: 1.0, b: 0.98 },
        warmth: 0.4,
        particleDensity: 0.5,
        ceilingLightsOn: true,
      };
      
    case "afternoon":
      // Slightly warmer afternoon light
      const afternoonProgress = (hour - 13) / 4;
      return {
        ambientIntensity: 0.55 - afternoonProgress * 0.1,
        ambientColor: { r: 1.0, g: 0.98, b: 0.95 },
        mainLightIntensity: 1.2 - afternoonProgress * 0.2,
        mainLightColor: { r: 1.0, g: 0.95, b: 0.9 },
        warmth: 0.4 + afternoonProgress * 0.2,
        particleDensity: 0.6 + afternoonProgress * 0.2,
        ceilingLightsOn: true,
      };
      
    case "evening":
      // Golden hour warm light, dimming
      const eveningProgress = (hour - 17) / 2;
      return {
        ambientIntensity: 0.35 - eveningProgress * 0.15,
        ambientColor: { r: 1.0, g: 0.9, b: 0.8 },
        mainLightIntensity: 0.8 - eveningProgress * 0.4,
        mainLightColor: { r: 1.0, g: 0.85, b: 0.7 },
        warmth: 0.7 + eveningProgress * 0.2,
        particleDensity: 0.9,
        ceilingLightsOn: true,
      };
      
    case "night":
      // Dim, warm interior lights only
      return {
        ambientIntensity: 0.15,
        ambientColor: { r: 0.8, g: 0.7, b: 0.6 },
        mainLightIntensity: 0.3,
        mainLightColor: { r: 1.0, g: 0.85, b: 0.7 },
        warmth: 0.9,
        particleDensity: 1.0,
        ceilingLightsOn: true,
      };
      
    case "afterHours":
    default:
      // Very dim, minimal lighting
      return {
        ambientIntensity: 0.08,
        ambientColor: { r: 0.6, g: 0.6, b: 0.8 },
        mainLightIntensity: 0.15,
        mainLightColor: { r: 0.9, g: 0.85, b: 0.8 },
        warmth: 0.5,
        particleDensity: 0.3,
        ceilingLightsOn: false,
      };
  }
}

// ── Agent Presence ──

/**
 * Get the target number of "present" agents based on time of day.
 * Returns a fraction (0-1) of total agents that should be visible.
 */
export function getAgentPresenceRatio(): number {
  const hour = getOfficeHour();
  
  // Morning arrival (8-9): 0.3 -> 1.0
  if (hour >= 8 && hour < 9) {
    return 0.3 + (hour - 8) * 0.7;
  }
  
  // Full day (9-17): 1.0
  if (hour >= 9 && hour < 17) {
    return 1.0;
  }
  
  // Evening departure (17-19): 1.0 -> 0.2
  if (hour >= 17 && hour < 19) {
    return 1.0 - (hour - 17) * 0.4;
  }
  
  // Night workers (19-20): 0.2
  if (hour >= 19 && hour < 20) {
    return 0.2;
  }
  
  // After hours: 0.1 (security/cleaning maybe)
  return 0.1;
}

// ── Control Functions ──

/**
 * Reset the cycle to start from morning.
 */
export function resetCycle(): void {
  cycleStartTime = Date.now();
  isPaused = false;
}

/**
 * Set the current time to a specific hour (for testing/demo).
 */
export function setOfficeHour(hour: number): void {
  // Calculate what cycleStartTime would need to be for this hour
  const targetHour = hour % 24;
  const hoursFromStart = targetHour - OFFICE_DAY_START;
  const msOffset = hoursFromStart * REAL_MS_PER_OFFICE_HOUR;
  cycleStartTime = Date.now() - msOffset;
  isPaused = false;
}

/**
 * Pause the cycle at the current time.
 */
export function pauseCycle(): void {
  pausedHour = getOfficeHour();
  isPaused = true;
}

/**
 * Resume the cycle from the paused time.
 */
export function resumeCycle(): void {
  if (isPaused) {
    setOfficeHour(pausedHour);
    isPaused = false;
  }
}

/**
 * Check if the cycle is paused.
 */
export function isCyclePaused(): boolean {
  return isPaused;
}

/**
 * Get the cycle speed multiplier (for UI display).
 * Returns "1 min = 1 hr"
 */
export function getCycleSpeed(): string {
  return "1 min = 1 hr";
}

// ── Hooks for Components ──

/**
 * Get all cycle state for UI display.
 */
export interface CycleState {
  hour: number;
  formattedTime: string;
  period: DayPeriod;
  activityMultiplier: number;
  agentPresence: number;
  lighting: LightingParams;
  isPaused: boolean;
}

export function getCycleState(): CycleState {
  return {
    hour: getOfficeHour(),
    formattedTime: getFormattedTime(),
    period: getDayPeriod(),
    activityMultiplier: getActivityMultiplier(),
    agentPresence: getAgentPresenceRatio(),
    lighting: getLightingParams(),
    isPaused,
  };
}
