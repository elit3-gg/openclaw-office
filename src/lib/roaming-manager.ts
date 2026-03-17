/**
 * Roaming manager — runs as a setInterval, checks idle agents
 * and triggers casual movements via the office store.
 *
 * Call startRoaming() once when the app connects to Gateway.
 * Call stopRoaming() on disconnect.
 */

import type { VisualAgent } from "@/gateway/types";
import { ZONES } from "./constants";

const TICK_INTERVAL_MS = 2000; // Check every 2 seconds
const MIN_IDLE_BEFORE_ROAM_MS = 8000; // Must be idle 8s before first roam
const ROAM_CHANCE_PER_TICK = 0.08; // 8% chance per tick per agent
const HANGOUT_MIN_MS = 5000;
const HANGOUT_MAX_MS = 20000;
const COOLDOWN_MIN_MS = 15000;
const COOLDOWN_MAX_MS = 60000;

type RoamAction = "coffee" | "visit" | "stroll" | "stretch";

interface AgentRoamState {
  cooldownUntil: number;
  hangoutUntil: number;
  isRoaming: boolean;
  homePosition: { x: number; y: number } | null;
  homeZone: string | null;
}

const agentStates = new Map<string, AgentRoamState>();
let intervalId: ReturnType<typeof setInterval> | null = null;

// Callback set by the consumer (office store)
let onRoam: ((agentId: string, toZone: string, targetPos: { x: number; y: number }) => void) | null = null;
let onReturn: ((agentId: string, toZone: string, targetPos: { x: number; y: number }) => void) | null = null;

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomPositionInZone(zoneName: string): { x: number; y: number } {
  const zone = ZONES[zoneName as keyof typeof ZONES];
  if (!zone) return { x: 300, y: 200 };
  const pad = 40;
  return {
    x: zone.x + pad + Math.random() * (zone.width - pad * 2),
    y: zone.y + pad + Math.random() * (zone.height - pad * 2),
  };
}

function pickAction(): RoamAction {
  const r = Math.random();
  if (r < 0.15) return "coffee";
  if (r < 0.4) return "visit";
  if (r < 0.6) return "stroll";
  return "stretch";
}

function tick(getAgents: () => Map<string, VisualAgent>) {
  const now = Date.now();
  const agents = getAgents();

  for (const [id, agent] of agents) {
    // Skip non-main agents, placeholders, unconfirmed
    if (agent.isPlaceholder || !agent.confirmed) continue;
    // Skip actively working agents
    if (agent.status !== "idle") {
      // Reset roaming state if agent became active
      const state = agentStates.get(id);
      if (state?.isRoaming) {
        state.isRoaming = false;
        // Return home
        if (state.homePosition && state.homeZone && onReturn) {
          onReturn(id, state.homeZone, state.homePosition);
        }
      }
      continue;
    }
    // Skip walking agents
    if (agent.movement !== null) continue;

    let state = agentStates.get(id);
    if (!state) {
      state = {
        cooldownUntil: now + randomRange(3000, 10000), // Stagger initial roaming
        hangoutUntil: 0,
        isRoaming: false,
        homePosition: { ...agent.position },
        homeZone: agent.zone,
      };
      agentStates.set(id, state);
    }

    // Update home position when at desk and not roaming
    if (!state.isRoaming && agent.zone === "desk") {
      state.homePosition = { ...agent.position };
      state.homeZone = agent.zone;
    }

    // If roaming and hangout expired, return home
    if (state.isRoaming && now >= state.hangoutUntil) {
      state.isRoaming = false;
      state.cooldownUntil = now + randomRange(COOLDOWN_MIN_MS, COOLDOWN_MAX_MS);
      if (state.homePosition && state.homeZone && onReturn) {
        onReturn(id, state.homeZone, state.homePosition);
      }
      continue;
    }

    // Still on cooldown or hanging out
    if (now < state.cooldownUntil || state.isRoaming) continue;

    // Must have been idle for a while
    const idleTime = now - agent.lastActiveAt;
    if (idleTime < MIN_IDLE_BEFORE_ROAM_MS) continue;

    // Random chance to roam
    if (Math.random() > ROAM_CHANCE_PER_TICK) continue;

    // Pick an action and execute
    const action = pickAction();
    let targetZone: string;
    let targetPos: { x: number; y: number };

    switch (action) {
      case "coffee":
        targetZone = "lounge";
        targetPos = randomPositionInZone("lounge");
        break;
      case "visit": {
        // Pick random other agent to visit
        const others = Array.from(agents.values()).filter(
          (a) => a.id !== id && a.confirmed && !a.isPlaceholder && a.zone !== "corridor",
        );
        if (others.length > 0) {
          const target = others[Math.floor(Math.random() * others.length)];
          targetZone = target.zone;
          const offset = 15 + Math.random() * 20;
          const angle = Math.random() * Math.PI * 2;
          targetPos = {
            x: target.position.x + Math.cos(angle) * offset,
            y: target.position.y + Math.sin(angle) * offset,
          };
        } else {
          targetZone = "meeting";
          targetPos = randomPositionInZone("meeting");
        }
        break;
      }
      case "stroll": {
        const zones = ["meeting", "hotDesk"];
        targetZone = zones[Math.floor(Math.random() * zones.length)];
        targetPos = randomPositionInZone(targetZone);
        break;
      }
      case "stretch":
      default:
        targetZone = agent.zone || "desk";
        targetPos = randomPositionInZone(targetZone);
        break;
    }

    state.isRoaming = true;
    state.hangoutUntil = now + randomRange(HANGOUT_MIN_MS, HANGOUT_MAX_MS);

    if (onRoam) {
      onRoam(id, targetZone, targetPos);
    }
  }
}

export function startRoaming(
  getAgents: () => Map<string, VisualAgent>,
  roamCallback: (agentId: string, toZone: string, targetPos: { x: number; y: number }) => void,
  returnCallback: (agentId: string, toZone: string, targetPos: { x: number; y: number }) => void,
): void {
  stopRoaming();
  onRoam = roamCallback;
  onReturn = returnCallback;
  intervalId = setInterval(() => tick(getAgents), TICK_INTERVAL_MS);
}

export function stopRoaming(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  onRoam = null;
  onReturn = null;
  agentStates.clear();
}
