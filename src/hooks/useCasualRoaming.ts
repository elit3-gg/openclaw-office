import { useEffect, useRef } from "react";
import { useOfficeStore } from "@/store/office-store";
import { createRoamingState, tickRoaming, cancelRoaming, type RoamingState } from "@/lib/casual-roaming";

const TICK_INTERVAL_MS = 5_000;

/**
 * Hook that drives casual roaming behavior for agents.
 * Agents periodically get up, walk around, visit colleagues, get coffee, etc.
 */
export function useCasualRoaming() {
  const connectionStatus = useOfficeStore((s) => s.connectionStatus);
  const stateRef = useRef<RoamingState | null>(null);

  useEffect(() => {
    if (connectionStatus !== "connected") return;

    const roamState = createRoamingState();
    stateRef.current = roamState;

    // Set up return callback
    roamState.onReturn = (agentId, zone, pos) => {
      const store = useOfficeStore.getState();
      const agent = store.agents.get(agentId);
      if (agent && agent.status === "idle" && !agent.movement) {
        store.startMovement(agentId, zone, pos);
      }
    };

    const interval = setInterval(() => {
      const store = useOfficeStore.getState();
      const agents = store.agents;

      // Cancel roaming for agents that became active
      for (const [agentId] of roamState.active) {
        const agent = agents.get(agentId);
        if (agent && agent.status !== "idle") {
          const returnInfo = cancelRoaming(roamState, agentId);
          if (returnInfo) {
            store.startMovement(agentId, returnInfo.returnZone, returnInfo.returnPos);
          }
        }
      }

      // Tick roaming — get new movement commands
      const commands = tickRoaming(roamState, agents);
      for (const cmd of commands) {
        store.startMovement(cmd.agentId, cmd.toZone, cmd.targetPos);
      }
    }, TICK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      stateRef.current = null;
    };
  }, [connectionStatus]);
}
