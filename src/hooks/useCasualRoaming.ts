import { useEffect, useRef } from "react";
import { useOfficeStore } from "@/store/office-store";
import {
  createActivityState,
  tickActivities,
  setActivityMultiplier,
  type ActivityState,
  type ActivityTickResult,
} from "@/lib/office-activities";
import { getActivityMultiplier as getAmbientActivityMultiplier } from "@/lib/ambient-cycle";

const TICK_INTERVAL_MS = 4_000;

// Shared activity state — accessible by rendering components
let sharedActivityState: ActivityState | null = null;
let lastTickResult: ActivityTickResult | null = null;

export function getActivityState(): ActivityState | null {
  return sharedActivityState;
}

export function getLastTickResult(): ActivityTickResult | null {
  return lastTickResult;
}

/**
 * Hook that drives smart office activities for agents.
 * Agents take coffee breaks, sit on couches, have meetings, pair-chat, etc.
 */
export function useCasualRoaming() {
  const connectionStatus = useOfficeStore((s) => s.connectionStatus);
  const stateRef = useRef<ActivityState | null>(null);

  useEffect(() => {
    if (connectionStatus !== "connected") return;

    const actState = createActivityState();
    stateRef.current = actState;
    sharedActivityState = actState;

    const interval = setInterval(() => {
      const store = useOfficeStore.getState();
      const agents = store.agents;

      // Update activity multiplier from ambient cycle
      const ambientMultiplier = getAmbientActivityMultiplier();
      setActivityMultiplier(actState, ambientMultiplier);

      const dt = TICK_INTERVAL_MS / 1000;
      const result = tickActivities(actState, agents, dt);
      lastTickResult = result;

      // Execute move commands
      for (const cmd of result.moveCommands) {
        const agent = agents.get(cmd.agentId);
        if (agent && !agent.movement) {
          store.startMovement(cmd.agentId, cmd.toZone, cmd.targetPos);
        }
      }
    }, TICK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      stateRef.current = null;
      sharedActivityState = null;
      lastTickResult = null;
    };
  }, [connectionStatus]);
}
