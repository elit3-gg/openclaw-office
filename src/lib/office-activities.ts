/**
 * Smart office activity system — agents do realistic office things.
 *
 * Activities (with priorities):
 * - coffeeRun:       Walk to lounge coffee area, pause, return
 * - couchBreak:      Go sit on couch, relax, return
 * - waterCooler:     Stand at water cooler, chat with nearby agent
 * - meeting:         2-4 agents gather at meeting table, face each other, take turns "talking"
 * - pairChat:        Two agents walk to each other, face each other, chat briefly
 * - deskWork:        Return to desk, type/think (default idle)
 * - phoneCalling:    Walk to quiet corner, face away, "talk" on phone
 * - whiteboarding:   2-3 agents go to whiteboard zone, one "draws" while others watch
 * - lunchBreak:      Agent leaves the office (walks to edge, fades out), returns after a while
 * - stretching:      Agent stands up at desk, does stretching animation
 * - presentationMode: One agent at whiteboard, all others gather to watch
 * - codeReview:      Two agents stand at one desk together, both face the "monitor"
 *
 * Agents take turns, face interaction partners, and don't all move at once.
 */

import type { VisualAgent, AgentZone } from "@/gateway/types";
// Note: VisualAgent is already imported above
import { ZONES } from "./constants";
import { getDialogueForActivity, shouldShowDialogue, getDialogueProbability } from "./agent-dialogue";

// ── Types ──

export type ActivityType =
  | "deskWork"
  | "coffeeRun"
  | "couchBreak"
  | "waterCooler"
  | "meeting"
  | "pairChat"
  | "phoneCalling"
  | "whiteboarding"
  | "lunchBreak"
  | "stretching"
  | "presentationMode"
  | "codeReview";

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
  currentDialogue: string | null;      // Current dialogue message for speaking agent
  dialogueTimer: number;               // Timer to rotate dialogues
  previousActivity: ActivityType | null; // For activity chaining
}

export type ActivityPhase = "traveling" | "arrived" | "interacting" | "returning" | "away";

export interface ActivityState {
  activities: Map<string, Activity>;  // activity ID → Activity
  agentActivity: Map<string, string>; // agentId → activity ID
  cooldowns: Map<string, number>;     // agentId → timestamp when available
  meetingCooldown: number;            // Global meeting cooldown timestamp
  presentationCooldown: number;       // Global presentation cooldown timestamp
  lastTick: number;
  activityMultiplier: number;         // Controlled by day/night cycle
}

// ── Constants ──

const MAX_CONCURRENT_ACTIVITIES = 6;
const AGENT_COOLDOWN_MS = 12_000;
const MEETING_COOLDOWN_MS = 45_000;
const PRESENTATION_COOLDOWN_MS = 60_000;
const SPEAK_TURN_DURATION: [number, number] = [2, 5]; // seconds per speaker turn
const DIALOGUE_ROTATE_TIME = 3; // seconds between dialogue changes

// Activity weights (probability of being chosen)
const ACTIVITY_WEIGHTS: Record<ActivityType, number> = {
  deskWork: 0,          // Not randomly triggered — it's the default
  coffeeRun: 20,
  couchBreak: 15,
  waterCooler: 12,
  meeting: 12,
  pairChat: 18,
  phoneCalling: 8,
  whiteboarding: 10,
  lunchBreak: 5,
  stretching: 10,
  presentationMode: 6,
  codeReview: 12,
};

// Activity chaining probabilities (after activity X, might do Y)
const ACTIVITY_CHAINS: Partial<Record<ActivityType, { next: ActivityType; chance: number }[]>> = {
  coffeeRun: [
    { next: "pairChat", chance: 0.3 },
    { next: "couchBreak", chance: 0.2 },
  ],
  meeting: [
    { next: "coffeeRun", chance: 0.25 },
    { next: "couchBreak", chance: 0.2 },
    { next: "stretching", chance: 0.15 },
  ],
  presentationMode: [
    { next: "coffeeRun", chance: 0.3 },
    { next: "pairChat", chance: 0.2 },
  ],
  codeReview: [
    { next: "coffeeRun", chance: 0.25 },
    { next: "stretching", chance: 0.2 },
  ],
  whiteboarding: [
    { next: "coffeeRun", chance: 0.2 },
    { next: "pairChat", chance: 0.15 },
  ],
};

// Phase durations in seconds
const PHASE_DURATIONS: Record<ActivityType, Record<string, [number, number]>> = {
  deskWork:         { arrived: [999, 999] },
  coffeeRun:        { traveling: [3, 5], arrived: [4, 8], returning: [3, 5] },
  couchBreak:       { traveling: [3, 5], arrived: [8, 15], returning: [3, 5] },
  waterCooler:      { traveling: [3, 5], interacting: [5, 10], returning: [3, 5] },
  meeting:          { traveling: [3, 5], interacting: [12, 25], returning: [3, 5] },
  pairChat:         { traveling: [2, 4], interacting: [5, 10], returning: [2, 4] },
  phoneCalling:     { traveling: [2, 4], interacting: [8, 15], returning: [2, 4] },
  whiteboarding:    { traveling: [3, 5], interacting: [10, 20], returning: [3, 5] },
  lunchBreak:       { traveling: [3, 5], away: [15, 30], returning: [3, 5] },
  stretching:       { arrived: [5, 10] },
  presentationMode: { traveling: [3, 5], interacting: [15, 30], returning: [3, 5] },
  codeReview:       { traveling: [2, 4], interacting: [8, 15], returning: [2, 4] },
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

const WHITEBOARD_POSITION = {
  x: ZONES.meeting.x + ZONES.meeting.width - 60,
  y: ZONES.meeting.y + 80,
};

const PHONE_CORNERS = [
  { x: ZONES.desk.x + 20, y: ZONES.desk.y + ZONES.desk.height - 30 },
  { x: ZONES.hotDesk.x + ZONES.hotDesk.width - 30, y: ZONES.hotDesk.y + 30 },
  { x: ZONES.lounge.x + 30, y: ZONES.lounge.y + ZONES.lounge.height - 30 },
];

const EXIT_POSITION = {
  x: ZONES.lounge.x + ZONES.lounge.width / 2,
  y: ZONES.lounge.y + ZONES.lounge.height + 50,
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

function weightedPick(multiplier: number = 1): ActivityType {
  const entries = Object.entries(ACTIVITY_WEIGHTS).filter(([, w]) => w > 0) as [ActivityType, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [type, weight] of entries) {
    r -= weight * multiplier;
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

function getWhiteboardPositions(count: number, presenterIdx: number = 0): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  // Presenter stands at whiteboard
  positions.push({ x: WHITEBOARD_POSITION.x, y: WHITEBOARD_POSITION.y });
  
  // Watchers form a semicircle facing the whiteboard
  const watcherCount = count - 1;
  for (let i = 0; i < watcherCount; i++) {
    const angle = Math.PI * 0.3 + (Math.PI * 0.4 * i) / Math.max(watcherCount - 1, 1);
    const r = 70 + Math.random() * 20;
    positions.push({
      x: WHITEBOARD_POSITION.x - Math.cos(angle) * r,
      y: WHITEBOARD_POSITION.y + Math.sin(angle) * r - 30,
    });
  }
  
  // Swap presenter position if needed
  if (presenterIdx > 0 && presenterIdx < positions.length) {
    [positions[0], positions[presenterIdx]] = [positions[presenterIdx], positions[0]];
  }
  
  return positions;
}

function getPresentationPositions(count: number): { x: number; y: number }[] {
  // Similar to whiteboarding but with more formal seating
  const positions: { x: number; y: number }[] = [];
  // Presenter at whiteboard
  positions.push({ x: WHITEBOARD_POSITION.x, y: WHITEBOARD_POSITION.y });
  
  // Audience in rows
  const audienceCount = count - 1;
  const rows = Math.ceil(audienceCount / 3);
  let idx = 0;
  for (let row = 0; row < rows && idx < audienceCount; row++) {
    const colsInRow = Math.min(3, audienceCount - idx);
    for (let col = 0; col < colsInRow; col++) {
      positions.push({
        x: MEETING_TABLE_CENTER.x - 60 + col * 40,
        y: MEETING_TABLE_CENTER.y - 20 + row * 35,
      });
      idx++;
    }
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

function getCodeReviewPositions(targetAgent: VisualAgent): [{ x: number; y: number }, { x: number; y: number }] {
  // Both agents at target agent's desk
  return [
    { x: targetAgent.position.x - 20, y: targetAgent.position.y },
    { x: targetAgent.position.x + 20, y: targetAgent.position.y },
  ];
}

function getStretchingPosition(agent: VisualAgent): { x: number; y: number } {
  // Stand up near current position
  return {
    x: agent.position.x + randomRange(-10, 10),
    y: agent.position.y + randomRange(-5, 5),
  };
}

// ── Core ──

export function createActivityState(): ActivityState {
  return {
    activities: new Map(),
    agentActivity: new Map(),
    cooldowns: new Map(),
    meetingCooldown: 0,
    presentationCooldown: 0,
    lastTick: Date.now(),
    activityMultiplier: 1.0,
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
  previousActivity: ActivityType | null = null,
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
    currentDialogue: null,
    dialogueTimer: 0,
    previousActivity,
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
      activity.speakingAgent = participants[0].id;
      activity.speakTurnTimer = randomRange(...SPEAK_TURN_DURATION);
      break;
    }
    case "meeting": {
      const positions = getMeetingPositions(participants.length);
      for (let i = 0; i < participants.length; i++) {
        activity.targetPositions.set(participants[i].id, { ...positions[i], zone: "meeting" });
        commands.push({ agentId: participants[i].id, toZone: "meeting", targetPos: positions[i] });
      }
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
    case "phoneCalling": {
      const corner = randomPick(PHONE_CORNERS);
      const zone: AgentZone = corner.x < ZONES.meeting.x ? (corner.y < ZONES.hotDesk.y ? "desk" : "hotDesk") : "lounge";
      activity.targetPositions.set(participants[0].id, { ...corner, zone });
      commands.push({ agentId: participants[0].id, toZone: zone, targetPos: corner });
      activity.speakingAgent = participants[0].id;
      break;
    }
    case "whiteboarding": {
      const positions = getWhiteboardPositions(participants.length);
      for (let i = 0; i < participants.length; i++) {
        activity.targetPositions.set(participants[i].id, { ...positions[i], zone: "meeting" });
        commands.push({ agentId: participants[i].id, toZone: "meeting", targetPos: positions[i] });
      }
      activity.speakingAgent = participants[0].id; // First is the "drawer"
      activity.speakTurnTimer = randomRange(5, 10);
      // All face the whiteboard (first participant)
      for (let i = 1; i < participants.length; i++) {
        activity.facingTargets.set(participants[i].id, participants[0].id);
      }
      break;
    }
    case "lunchBreak": {
      activity.targetPositions.set(participants[0].id, { ...EXIT_POSITION, zone: "lounge" });
      commands.push({ agentId: participants[0].id, toZone: "lounge", targetPos: EXIT_POSITION });
      break;
    }
    case "stretching": {
      const pos = getStretchingPosition(participants[0]);
      const zone = participants[0].zone as AgentZone;
      activity.targetPositions.set(participants[0].id, { ...pos, zone });
      activity.phase = "arrived"; // Stretching doesn't need travel
      activity.phaseTimer = randomRange(...(PHASE_DURATIONS.stretching.arrived ?? [5, 10]));
      break;
    }
    case "presentationMode": {
      const positions = getPresentationPositions(participants.length);
      for (let i = 0; i < participants.length; i++) {
        activity.targetPositions.set(participants[i].id, { ...positions[i], zone: "meeting" });
        commands.push({ agentId: participants[i].id, toZone: "meeting", targetPos: positions[i] });
      }
      activity.speakingAgent = participants[0].id; // Presenter
      activity.speakTurnTimer = randomRange(8, 15);
      // All face the presenter
      for (let i = 1; i < participants.length; i++) {
        activity.facingTargets.set(participants[i].id, participants[0].id);
      }
      break;
    }
    case "codeReview": {
      const [posA, posB] = getCodeReviewPositions(participants[0]);
      const zone = participants[0].zone as AgentZone;
      activity.targetPositions.set(participants[0].id, { ...posA, zone });
      activity.targetPositions.set(participants[1].id, { ...posB, zone });
      commands.push({ agentId: participants[0].id, toZone: zone, targetPos: posA });
      commands.push({ agentId: participants[1].id, toZone: zone, targetPos: posB });
      // Both face forward (the "monitor")
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
  phoneAgents: Set<string>;               // Agents on phone
  whiteboardingAgents: Set<string>;       // Agents at whiteboard
  stretchingAgents: Set<string>;          // Agents stretching
  presentingAgents: Set<string>;          // Agents presenting
  reviewingAgents: Set<string>;           // Agents reviewing code
  awayAgents: Set<string>;                // Agents on lunch break
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
    phoneAgents: new Set(),
    whiteboardingAgents: new Set(),
    stretchingAgents: new Set(),
    presentingAgents: new Set(),
    reviewingAgents: new Set(),
    awayAgents: new Set(),
  };

  // ── Update existing activities ──
  const toRemove: string[] = [];

  for (const [actId, act] of state.activities) {
    act.phaseTimer -= dt;
    act.dialogueTimer -= dt;

    // Collect state for rendering
    if (act.phase === "interacting" || act.phase === "arrived") {
      // Update facing
      for (const [agentId, targetId] of act.facingTargets) {
        result.facingUpdates.set(agentId, targetId);
      }

      // Rotate dialogue if timer expired
      if (act.dialogueTimer <= 0 && act.speakingAgent) {
        act.dialogueTimer = DIALOGUE_ROTATE_TIME;
      }

      // Meeting/chat speaker rotation
      if ((act.type === "meeting" || act.type === "pairChat" || act.type === "waterCooler" || 
           act.type === "whiteboarding" || act.type === "codeReview") && act.speakingAgent) {
        result.speakingAgents.add(act.speakingAgent);
        act.speakTurnTimer -= dt;
        if (act.speakTurnTimer <= 0) {
          // Next speaker
          const currentIdx = act.participants.indexOf(act.speakingAgent);
          const nextIdx = (currentIdx + 1) % act.participants.length;
          act.speakingAgent = act.participants[nextIdx];
          act.speakTurnTimer = randomRange(...SPEAK_TURN_DURATION);
          act.dialogueTimer = 0; // Trigger new dialogue
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
      if (act.type === "phoneCalling") {
        for (const pid of act.participants) result.phoneAgents.add(pid);
      }
      if (act.type === "whiteboarding") {
        for (const pid of act.participants) result.whiteboardingAgents.add(pid);
      }
      if (act.type === "stretching") {
        for (const pid of act.participants) result.stretchingAgents.add(pid);
      }
      if (act.type === "presentationMode") {
        if (act.speakingAgent) result.presentingAgents.add(act.speakingAgent);
      }
      if (act.type === "codeReview") {
        for (const pid of act.participants) result.reviewingAgents.add(pid);
      }
    }

    // Track away agents during lunch break
    if (act.type === "lunchBreak" && act.phase === "away") {
      for (const pid of act.participants) result.awayAgents.add(pid);
    }

    // Phase transitions
    if (act.phaseTimer <= 0) {
      switch (act.phase) {
        case "traveling": {
          let nextPhase: ActivityPhase;
          if (act.type === "coffeeRun" || act.type === "couchBreak") {
            nextPhase = "arrived";
          } else if (act.type === "lunchBreak") {
            nextPhase = "away";
          } else {
            nextPhase = "interacting";
          }
          act.phase = nextPhase;
          const durations = PHASE_DURATIONS[act.type][nextPhase];
          act.phaseTimer = durations ? randomRange(...durations) : 5;
          break;
        }
        case "arrived":
        case "interacting":
        case "away": {
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
          // Check for activity chaining
          const chains = ACTIVITY_CHAINS[act.type];
          let chainedActivity: ActivityType | null = null;
          if (chains) {
            for (const chain of chains) {
              if (Math.random() < chain.chance) {
                chainedActivity = chain.next;
                break;
              }
            }
          }
          
          // Store for potential chaining
          for (const pid of act.participants) {
            if (chainedActivity) {
              // Give a short cooldown to allow chaining
              state.cooldowns.set(pid, now + 2000);
            } else {
              state.cooldowns.set(pid, now + AGENT_COOLDOWN_MS);
            }
          }
          
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
  const effectiveMax = Math.floor(MAX_CONCURRENT_ACTIVITIES * state.activityMultiplier);
  
  if (activeCount < effectiveMax && Math.random() < state.activityMultiplier) {
    const eligible = getEligibleAgents(state, agents, now);
    if (eligible.length >= 1) {
      const type = weightedPick(state.activityMultiplier);
      let participants: VisualAgent[] = [];

      switch (type) {
        case "coffeeRun":
        case "couchBreak":
        case "phoneCalling":
        case "lunchBreak":
        case "stretching":
          participants = [randomPick(eligible)];
          break;
        case "waterCooler":
        case "pairChat":
        case "codeReview":
          if (eligible.length >= 2) {
            const a = randomPick(eligible);
            const remaining = eligible.filter((e) => e.id !== a.id);
            const b = randomPick(remaining);
            participants = [a, b];
          }
          break;
        case "whiteboarding":
          if (eligible.length >= 2) {
            const count = Math.min(eligible.length, 2 + Math.floor(Math.random() * 2)); // 2-3
            const shuffled = [...eligible].sort(() => Math.random() - 0.5);
            participants = shuffled.slice(0, count);
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
        case "presentationMode":
          if (eligible.length >= 4 && now > state.presentationCooldown) {
            const count = Math.min(eligible.length, 4 + Math.floor(Math.random() * 3)); // 4-6
            const shuffled = [...eligible].sort(() => Math.random() - 0.5);
            participants = shuffled.slice(0, count);
            state.presentationCooldown = now + PRESENTATION_COOLDOWN_MS;
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
 * Set the activity multiplier (controlled by day/night cycle)
 */
export function setActivityMultiplier(state: ActivityState, multiplier: number): void {
  state.activityMultiplier = Math.max(0, Math.min(2, multiplier));
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
  if (!actId) return false;
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

/**
 * Get current activity phase for an agent.
 */
export function getAgentActivityPhase(state: ActivityState, agentId: string): ActivityPhase | null {
  const actId = state.agentActivity.get(agentId);
  if (!actId) return null;
  const act = state.activities.get(actId);
  return act?.phase ?? null;
}

/**
 * Get current dialogue for an agent during activity.
 * Returns null if agent is not in an interactive activity phase.
 * Pass agents map for role-aware dialogue generation.
 */
export function getAgentDialogue(
  state: ActivityState, 
  agentId: string, 
  dt: number = 0,
  agents?: Map<string, VisualAgent>,
): string | null {
  const actId = state.agentActivity.get(agentId);
  if (!actId) return null;
  
  const act = state.activities.get(actId);
  if (!act) return null;
  
  // Only show dialogue during interactive phases
  if (act.phase !== "interacting" && act.phase !== "arrived") return null;
  
  // Only speaking agent or solo activities get dialogue
  const isSpeaker = act.speakingAgent === agentId;
  const isSoloActivity = act.participants.length === 1;
  
  if (!isSpeaker && !isSoloActivity) return null;
  
  // Get agent objects for role-aware dialogue
  const agent = agents?.get(agentId);
  let partnerAgent: VisualAgent | undefined;
  
  if (act.participants.length === 2) {
    const partnerId = act.participants.find(p => p !== agentId);
    if (partnerId) {
      partnerAgent = agents?.get(partnerId);
    }
  }
  
  // Check if it's time for a new dialogue
  if (shouldShowDialogue(agentId, dt)) {
    // Use probability to decide if we should actually show dialogue
    const prob = getDialogueProbability(act.type);
    if (Math.random() < prob) {
      act.currentDialogue = getDialogueForActivity(act.type, actId, agent, partnerAgent);
    }
  }
  
  return act.currentDialogue;
}

/**
 * Force a new dialogue for an agent (called when speaker changes).
 */
export function rotateAgentDialogue(
  state: ActivityState, 
  agentId: string,
  agents?: Map<string, VisualAgent>,
): void {
  const actId = state.agentActivity.get(agentId);
  if (!actId) return;
  
  const act = state.activities.get(actId);
  if (!act) return;
  
  const agent = agents?.get(agentId);
  let partnerAgent: VisualAgent | undefined;
  
  if (act.participants.length === 2) {
    const partnerId = act.participants.find(p => p !== agentId);
    if (partnerId) {
      partnerAgent = agents?.get(partnerId);
    }
  }
  
  act.currentDialogue = getDialogueForActivity(act.type, actId, agent, partnerAgent);
}
