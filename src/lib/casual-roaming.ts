/**
 * Casual roaming system — makes idle agents walk around the office naturally.
 *
 * Behaviors:
 * - Coffee break: walk to lounge, hang out, return to desk
 * - Visit colleague: walk to another agent's desk, chat, return
 * - Corridor stroll: walk through corridor, return
 */

import type { VisualAgent, AgentZone } from "@/gateway/types";
import { ZONES } from "./constants";

export type RoamingAction = "coffeeBreak" | "visitColleague" | "corridorStroll" | "waterCooler";

interface RoamEntry {
  action: RoamingAction;
  returnZone: AgentZone;
  returnPos: { x: number; y: number };
}

export interface RoamingState {
  active: Map<string, RoamEntry>;
  cooldowns: Map<string, number>;
  lastTick: number;
  onReturn: ((agentId: string, zone: AgentZone, pos: { x: number; y: number }) => void) | null;
}

const MAX_ROAMING = 3;
const MIN_COOLDOWN_MS = 20_000;
const MAX_COOLDOWN_MS = 90_000;
const ROAM_RETURN_DELAY_MS = 8_000;

const returnTimers = new Map<string, ReturnType<typeof setTimeout>>();

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomPointInZone(zone: { x: number; y: number; width: number; height: number }): { x: number; y: number } {
  return {
    x: zone.x + 40 + Math.random() * (zone.width - 80),
    y: zone.y + 40 + Math.random() * (zone.height - 80),
  };
}

export function createRoamingState(): RoamingState {
  return {
    active: new Map(),
    cooldowns: new Map(),
    lastTick: Date.now(),
    onReturn: null,
  };
}

function pickAction(): RoamingAction {
  const r = Math.random();
  if (r < 0.35) return "coffeeBreak";
  if (r < 0.60) return "visitColleague";
  if (r < 0.80) return "corridorStroll";
  return "waterCooler";
}

function getDestination(
  action: RoamingAction,
  agents: Map<string, VisualAgent>,
  selfId: string,
): { x: number; y: number; zone: AgentZone } {
  switch (action) {
    case "coffeeBreak":
    case "waterCooler": {
      const pos = randomPointInZone(ZONES.lounge);
      return { ...pos, zone: "lounge" };
    }
    case "visitColleague": {
      const candidates = Array.from(agents.values()).filter(
        (a) => a.id !== selfId && !a.isPlaceholder && a.confirmed && a.zone === "desk",
      );
      if (candidates.length > 0) {
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        return {
          x: target.position.x + (Math.random() - 0.5) * 30,
          y: target.position.y + 20,
          zone: "desk",
        };
      }
      const pos = randomPointInZone(ZONES.meeting);
      return { ...pos, zone: "meeting" };
    }
    case "corridorStroll": {
      const pos = randomPointInZone(ZONES.meeting);
      return { ...pos, zone: "meeting" };
    }
  }
}

export function tickRoaming(
  state: RoamingState,
  agents: Map<string, VisualAgent>,
): Array<{ agentId: string; toZone: AgentZone; targetPos: { x: number; y: number } }> {
  const now = Date.now();
  state.lastTick = now;
  const commands: Array<{ agentId: string; toZone: AgentZone; targetPos: { x: number; y: number } }> = [];

  const eligible = Array.from(agents.values()).filter((a) => {
    if (a.isPlaceholder || a.isSubAgent || !a.confirmed) return false;
    if (a.status !== "idle") return false;
    if (a.movement !== null) return false;
    if (state.active.has(a.id)) return false;
    const cooldown = state.cooldowns.get(a.id);
    if (cooldown && now < cooldown) return false;
    return true;
  });

  if (state.active.size < MAX_ROAMING && eligible.length > 0) {
    const agent = eligible[Math.floor(Math.random() * eligible.length)];
    const action = pickAction();
    const dest = getDestination(action, agents, agent.id);

    state.active.set(agent.id, {
      action,
      returnZone: agent.zone as AgentZone,
      returnPos: { ...agent.position },
    });

    state.cooldowns.set(agent.id, now + randomRange(MIN_COOLDOWN_MS, MAX_COOLDOWN_MS));

    commands.push({
      agentId: agent.id,
      toZone: dest.zone,
      targetPos: { x: dest.x, y: dest.y },
    });

    const existingTimer = returnTimers.get(agent.id);
    if (existingTimer) clearTimeout(existingTimer);

    returnTimers.set(agent.id, setTimeout(() => {
      returnTimers.delete(agent.id);
      const roamInfo = state.active.get(agent.id);
      if (roamInfo) {
        state.active.delete(agent.id);
        if (state.onReturn) {
          state.onReturn(agent.id, roamInfo.returnZone, roamInfo.returnPos);
        }
      }
    }, ROAM_RETURN_DELAY_MS));
  }

  return commands;
}

export function cancelRoaming(state: RoamingState, agentId: string): { returnZone: AgentZone; returnPos: { x: number; y: number } } | null {
  const info = state.active.get(agentId);
  if (!info) return null;

  state.active.delete(agentId);
  const timer = returnTimers.get(agentId);
  if (timer) {
    clearTimeout(timer);
    returnTimers.delete(agentId);
  }

  return { returnZone: info.returnZone, returnPos: info.returnPos };
}
