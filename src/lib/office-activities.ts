/**
 * Smart office activity system — agents do realistic office things.
 *
 * Activities (with priorities):
 * - coffeeRun:     Walk to lounge coffee area, pause, return
 * - couchBreak:    Go sit on couch, relax, return
 * - waterCooler:   Stand at water cooler, chat with nearby agent
 * - meeting:       2-4 agents gather at meeting table, face each other, take turns "talking"
 * - pairChat:      Two agents walk to each other, face each other, chat briefly
 * - deskWork:      Return to desk, type/think (default idle)
 *
 * Agents take turns, face interaction partners, and don't all move at once.
 */

import type { VisualAgent, AgentZone } from "@/gateway/types";
import { ZONES } from "./constants";

// ── Types ──

export type ActivityType =
  | "deskWork"
  | "coffeeRun"
  | "couchBreak"
  | "waterCooler"
  | "meeting"
  | "pairChat";

export interface Activity {
  type: ActivityType;
  participants: string[];      // Agent IDs involved
  phase: ActivityPhase;
  phaseTimer: number;          // Seconds remaining in current phase
  targetPositions: Map<string, { x: number; y: number; zone: AgentZone }>;
  facingTargets: Map<string, string>;  // agentId → agentId they should face
  speakingAgent: string | null;        // Who is currently "talking" in a meeting
  speakTurnTimer: number;              // Time until next speaker switch
  returnPositions: Map<string, { x: number; y: number; zone: AgentZone }>;
}

export type ActivityPhase = "traveling" | "arrived" | "interacting" | "returning";

export interface ActivityState {
  activities: Map<string, Activity>;  // activity ID → Activity
  agentActivity: Map<string, string>; // agentId → activity ID
  cooldowns: Map<string, number>;     // agentId → timestamp when available
  meetingCooldown: number;            // Global meeting cooldown timestamp
  lastTick: number;
}

// ── Constants ──

const MAX_CONCURRENT_ACTIVITIES = 4;
const AGENT_COOLDOWN_MS = 15_000;
const MEETING_COOLDOWN_MS = 30_000;
const SPEAK_TURN_DURATION: [number, number] = [2, 5]; // seconds per speaker turn

// Activity weights (probability of being chosen)
const ACTIVITY_WEIGHTS: Record<ActivityType, number> = {
  deskWork: 0,      // Not randomly triggered — it's the default
  coffeeRun: 25,
  couchBreak: 20,
  waterCooler: 15,
  meeting: 15,
  pairChat: 25,
};

// Phase durations in seconds
const PHASE_DURATIONS: Record<ActivityType, Record<string, [number, number]>> = {
  deskWork:     { arrived: [999, 999] },
  coffeeRun:    { traveling: [3, 5], arrived: [4, 8], returning: [3, 5] },
  couchBreak:   { traveling: [3, 5], arrived: [8, 15], returning: [3, 5] },
  waterCooler:  { traveling: [3, 5], interacting: [5, 10], returning: [3, 5] },
  meeting:      { traveling: [3, 5], interacting: [10, 20], returning: [3, 5] },
  pairChat:     { traveling: [2, 4], interacting: [5, 10], returning: [2, 4] },
};

// ── Points of interest in the office ──

const COFFEE_SPOTS = [
  { x: ZONES.lounge.x + ZONES.lounge.width - 60, y: ZONES.lounge.y + 40 },
  { x: ZONES.lounge.x + ZONES.lounge.width - 80, y: ZONES.lounge.y + 60 },
];

const COUCH_SPOTS = [
  { x: ZONES.lounge.x + 60, y: ZONES.lounge.y + ZONES.lounge.height / 2 },
  { x: ZONES.lounge.x + 120, y: ZONES.lounge.y + ZONES.lounge.height / 2 },
  { x: ZONES.lounge.x + 60, y: ZONES.lounge.y + ZONES.lounge.height / 2 + 40 },
];

const WATER_COOLER_SPOTS = [
  { x: ZONES.lounge.x + ZONES.lounge.width / 2, y: ZONES.lounge.y + 50 },
];

const MEETING_TABLE_CENTER = {
  x: ZONES.meeting.x + ZONES.meeting.width / 2,
  y: ZONES.meeting.y + ZONES.meeting.height / 2,
};

// ── Helpers ──

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let activityCounter = 0;
function newActivityId(): string {
  return `act_${++activityCounter}_${Date.now()}`;
}

function weightedPick(): ActivityType {
  const entries = Object.entries(ACTIVITY_WEIGHTS).filter(([, w]) => w > 0) as [ActivityType, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [type, weight] of entries) {
    r -= weight;
    if (r <= 0) return type;
  }
  return "coffeeRun";
}

function getMeetingPositions(count: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const radius = 50 + count * 10;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    positions.push({
      x: MEETING_TABLE_CENTER.x + Math.cos(angle) * radius,
      y: MEETING_TABLE_CENTER.y + Math.sin(angle) * radius,
    });
  }
  return positions;
}

function getChatPositions(agentA: VisualAgent, agentB: VisualAgent): [{ x: number; y: number }, { x: number; y: number }] {
  // Meet halfway between them, offset slightly
  const midX = (agentA.position.x + agentB.position.x) / 2;
  const midY = (agentA.position.y + agentB.position.y) / 2;
  const spread = 25;
  return [
    { x: midX - spread, y: midY },
    { x: midX + spread, y: midY },
  ];
}

// ── Core ──

export function createActivityState(): ActivityState {
  return {
    activities: new Map(),
    agentActivity: new Map(),
    cooldowns: new Map(),
    meetingCooldown: 0,
    lastTick: Date.now(),
  };
}

function isAgentFree(state: ActivityState, agentId: string, now: number): boolean {
  if (state.agentActivity.has(agentId)) return false;
  const cd = state.cooldowns.get(agentId);
  if (cd && now < cd) return false;
  return true;
}

function getEligibleAgents(state: ActivityState, agents: Map<string, VisualAgent>, now: number): VisualAgent[] {
  return Array.from(agents.values()).filter((a) => {
    if (a.isPlaceholder || a.isSubAgent || !a.confirmed) return false;
    if (a.status !== "idle") return false;
    if (a.movement !== null) return false;
    return isAgentFree(state, a.id, now);
  });
}

function startActivity(
  state: ActivityState,
  type: ActivityType,
  participants: VisualAgent[],
  _agents: Map<string, VisualAgent>,
): { commands: MoveCommand[] } | null {
  const commands: MoveCommand[] = [];
  const activity: Activity = {
    type,
    participants: participants.map((p) => p.id),
    phase: "traveling",
    phaseTimer: randomRange(...(PHASE_DURATIONS[type].traveling ?? [3, 5])),
    targetPositions: new Map(),
    facingTargets: new Map(),
    speakingAgent: null,
    speakTurnTimer: 0,
    returnPositions: new Map(),
  };

  // Save return positions
  for (const p of participants) {
    activity.returnPositions.set(p.id, { x: p.position.x, y: p.position.y, zone: p.zone as AgentZone });
  }

  switch (type) {
    case "coffeeRun": {
      const spot = randomPick(COFFEE_SPOTS);
      const jitter = { x: spot.x + randomRange(-15, 15), y: spot.y + randomRange(-10, 10) };
      activity.targetPositions.set(participants[0].id, { ...jitter, zone: "lounge" });
      commands.push({ agentId: participants[0].id, toZone: "lounge", targetPos: jitter });
      break;
    }
    case "couchBreak": {
      const spot = randomPick(COUCH_SPOTS);
      activity.targetPositions.set(participants[0].id, { ...spot, zone: "lounge" });
      commands.push({ agentId: participants[0].id, toZone: "lounge", targetPos: spot });
      break;
    }
    case "waterCooler": {
      const spot = WATER_COOLER_SPOTS[0];
      for (let i = 0; i < participants.length; i++) {
        const pos = { x: spot.x + (i - 0.5) * 30, y: spot.y + randomRange(-10, 10) };
        activity.targetPositions.set(participants[i].id, { ...pos, zone: "lounge" });
        commands.push({ agentId: participants[i].id, toZone: "lounge", targetPos: pos });
      }
      // Face each other
      if (participants.length === 2) {
        activity.facingTargets.set(participants[0].id, participants[1].id);
        activity.facingTargets.set(participants[1].id, participants[0].id);
      }
      break;
    }
    case "meeting": {
      const positions = getMeetingPositions(participants.length);
      for (let i = 0; i < participants.length; i++) {
        activity.targetPositions.set(participants[i].id, { ...positions[i], zone: "meeting" });
        commands.push({ agentId: participants[i].id, toZone: "meeting", targetPos: positions[i] });
      }
      // Everyone faces center (speaker will be set in interaction phase)
      activity.speakingAgent = participants[0].id;
      activity.speakTurnTimer = randomRange(...SPEAK_TURN_DURATION);
      // Set facing — each faces the next in circle
      for (let i = 0; i < participants.length; i++) {
        const nextIdx = (i + 1) % participants.length;
        activity.facingTargets.set(participants[i].id, participants[nextIdx].id);
      }
      break;
    }
    case "pairChat": {
      const [posA, posB] = getChatPositions(participants[0], participants[1]);
      // Meet in the zone of the agent closest to center
      const zone: AgentZone = "desk";
      activity.targetPositions.set(participants[0].id, { ...posA, zone });
      activity.targetPositions.set(participants[1].id, { ...posB, zone });
      commands.push({ agentId: participants[0].id, toZone: zone, targetPos: posA });
      commands.push({ agentId: participants[1].id, toZone: zone, targetPos: posB });
      // Face each other
      activity.facingTargets.set(participants[0].id, participants[1].id);
      activity.facingTargets.set(participants[1].id, participants[0].id);
      activity.speakingAgent = participants[0].id;
      activity.speakTurnTimer = randomRange(...SPEAK_TURN_DURATION);
      break;
    }
  }

  const actId = newActivityId();
  state.activities.set(actId, activity);
  for (const p of participants) {
    state.agentActivity.set(p.id, actId);
  }

  return { commands };
}

export interface MoveCommand {
  agentId: string;
  toZone: AgentZone;
  targetPos: { x: number; y: number };
}

export interface ActivityTickResult {
  moveCommands: MoveCommand[];
  facingUpdates: Map<string, string>;     // agentId → agentId to face
  speakingAgents: Set<string>;            // Agents currently "speaking" in interactions
  sittingAgents: Set<string>;             // Agents on couches
  drinkingAgents: Set<string>;            // Agents at coffee
}

/**
 * Main tick — call every 3-5 seconds from the roaming hook.
 */
export function tickActivities(
  state: ActivityState,
  agents: Map<string, VisualAgent>,
  dt: number,
): ActivityTickResult {
  const now = Date.now();
  state.lastTick = now;

  const result: ActivityTickResult = {
    moveCommands: [],
    facingUpdates: new Map(),
    speakingAgents: new Set(),
    sittingAgents: new Set(),
    drinkingAgents: new Set(),
  };

  // ── Update existing activities ──
  const toRemove: string[] = [];

  for (const [actId, act] of state.activities) {
    act.phaseTimer -= dt;

    // Collect state for rendering
    if (act.phase === "interacting" || act.phase === "arrived") {
      // Update facing
      for (const [agentId, targetId] of act.facingTargets) {
        result.facingUpdates.set(agentId, targetId);
      }

      // Meeting/chat speaker rotation
      if ((act.type === "meeting" || act.type === "pairChat" || act.type === "waterCooler") && act.speakingAgent) {
        result.speakingAgents.add(act.speakingAgent);
        act.speakTurnTimer -= dt;
        if (act.speakTurnTimer <= 0) {
          // Next speaker
          const currentIdx = act.participants.indexOf(act.speakingAgent);
          const nextIdx = (currentIdx + 1) % act.participants.length;
          act.speakingAgent = act.participants[nextIdx];
          act.speakTurnTimer = randomRange(...SPEAK_TURN_DURATION);
          // Update facing — everyone looks at speaker
          for (const pid of act.participants) {
            if (pid !== act.speakingAgent) {
              act.facingTargets.set(pid, act.speakingAgent);
            }
          }
        }
      }

      // Track activity-specific visual state
      if (act.type === "couchBreak") {
        for (const pid of act.participants) result.sittingAgents.add(pid);
      }
      if (act.type === "coffeeRun") {
        for (const pid of act.participants) result.drinkingAgents.add(pid);
      }
    }

    // Phase transitions
    if (act.phaseTimer <= 0) {
      switch (act.phase) {
        case "traveling": {
          const nextPhase = act.type === "coffeeRun" || act.type === "couchBreak" ? "arrived" : "interacting";
          act.phase = nextPhase;
          const durations = PHASE_DURATIONS[act.type][nextPhase];
          act.phaseTimer = durations ? randomRange(...durations) : 5;
          break;
        }
        case "arrived":
        case "interacting": {
          act.phase = "returning";
          const durations = PHASE_DURATIONS[act.type].returning;
          act.phaseTimer = durations ? randomRange(...durations) : 3;
          // Issue return commands
          for (const pid of act.participants) {
            const ret = act.returnPositions.get(pid);
            if (ret) {
              result.moveCommands.push({ agentId: pid, toZone: ret.zone, targetPos: { x: ret.x, y: ret.y } });
            }
          }
          break;
        }
        case "returning": {
          toRemove.push(actId);
          break;
        }
      }
    }
  }

  // Clean up finished activities
  for (const actId of toRemove) {
    const act = state.activities.get(actId);
    if (act) {
      for (const pid of act.participants) {
        state.agentActivity.delete(pid);
        state.cooldowns.set(pid, now + AGENT_COOLDOWN_MS);
      }
      state.activities.delete(actId);
    }
  }

  // Cancel activities for agents that became active (non-idle)
  for (const [agentId, actId] of state.agentActivity) {
    const agent = agents.get(agentId);
    if (agent && agent.status !== "idle") {
      const act = state.activities.get(actId);
      if (act) {
        // Return all participants
        for (const pid of act.participants) {
          state.agentActivity.delete(pid);
          const ret = act.returnPositions.get(pid);
          if (ret) {
            result.moveCommands.push({ agentId: pid, toZone: ret.zone, targetPos: { x: ret.x, y: ret.y } });
          }
        }
        state.activities.delete(actId);
      }
    }
  }

  // ── Start new activities ──
  const activeCount = state.activities.size;
  if (activeCount < MAX_CONCURRENT_ACTIVITIES) {
    const eligible = getEligibleAgents(state, agents, now);
    if (eligible.length >= 1) {
      const type = weightedPick();
      let participants: VisualAgent[] = [];

      switch (type) {
        case "coffeeRun":
        case "couchBreak":
          participants = [randomPick(eligible)];
          break;
        case "waterCooler":
          if (eligible.length >= 2) {
            const a = randomPick(eligible);
            const remaining = eligible.filter((e) => e.id !== a.id);
            const b = randomPick(remaining);
            participants = [a, b];
          }
          break;
        case "meeting":
          if (eligible.length >= 3 && now > state.meetingCooldown) {
            const count = Math.min(eligible.length, 2 + Math.floor(Math.random() * 3)); // 2-4
            const shuffled = [...eligible].sort(() => Math.random() - 0.5);
            participants = shuffled.slice(0, count);
            state.meetingCooldown = now + MEETING_COOLDOWN_MS;
          }
          break;
        case "pairChat":
          if (eligible.length >= 2) {
            const a = randomPick(eligible);
            const remaining = eligible.filter((e) => e.id !== a.id);
            const b = randomPick(remaining);
            participants = [a, b];
          }
          break;
      }

      if (participants.length > 0) {
        const result2 = startActivity(state, type, participants, agents);
        if (result2) {
          result.moveCommands.push(...result2.commands);
        }
      }
    }
  }

  return result;
}

/**
 * Get the facing target agent ID for an agent (for 3D face-toward rendering).
 */
export function getAgentFacingTarget(state: ActivityState, agentId: string): string | null {
  const actId = state.agentActivity.get(agentId);
  if (!actId) return null;
  const act = state.activities.get(actId);
  if (!act) return null;
  return act.facingTargets.get(agentId) ?? null;
}

/**
 * Is this agent currently the "speaker" in an interaction?
 */
export function isAgentSpeaking(state: ActivityState, agentId: string): boolean {
  const actId = state.agentActivity.get(agentId);
  if (!actId) return null as unknown as boolean;
  const act = state.activities.get(actId);
  if (!act) return false;
  return act.speakingAgent === agentId;
}

/**
 * Get current activity type for an agent.
 */
export function getAgentActivityType(state: ActivityState, agentId: string): ActivityType | null {
  const actId = state.agentActivity.get(agentId);
  if (!actId) return null;
  const act = state.activities.get(actId);
  return act?.type ?? null;
}
