import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useState, useMemo, Suspense } from "react";
import { useTranslation } from "react-i18next";
import * as THREE from "three";

import type { Group, Mesh } from "three";
import type { VisualAgent } from "@/gateway/types";
import { position2dTo3d } from "@/lib/position-allocator";
import { useOfficeStore } from "@/store/office-store";
import { getActivityState, getLastTickResult } from "@/hooks/useCasualRoaming";
import { getAgentFacingTarget, getAgentActivityType, getAgentDialogue } from "@/lib/office-activities";
import { ErrorIndicator } from "./ErrorIndicator";
import { SkillHologram } from "./SkillHologram";
import { SpriteCharacter } from "./SpriteCharacter";
import { ThinkingIndicator } from "./ThinkingIndicator";

interface AgentCharacterProps {
  agent: VisualAgent;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** Map agent status to emissive glow color */
function statusGlowColor(status: VisualAgent["status"]): string {
  switch (status) {
    case "thinking":
      return "#3b82f6";
    case "speaking":
      return "#a855f7";
    case "tool_calling":
      return "#f97316";
    case "error":
      return "#ef4444";
    case "spawning":
      return "#22d3ee";
    default:
      return "#000000";
  }
}

function statusGlowIntensity(status: VisualAgent["status"]): number {
  switch (status) {
    case "thinking":
    case "speaking":
    case "tool_calling":
    case "error":
      return 0.6;
    case "spawning":
      return 0.4;
    default:
      return 0;
  }
}

// Height constants for positioning overlays relative to characters (1.0 world-unit tall)
const CHAR_TOP = 1.15; // Top of 1.0-height character + margin
const NAME_Y = -0.15;  // Below character feet

/** Floating name plate — matches 2D PixiAgent style */
function NamePlate({ name, status }: { name: string; status: VisualAgent["status"] }) {
  const statusColor = statusGlowColor(status);
  const displayName = name.length > 12 ? name.slice(0, 11) + "…" : name;

  return (
    <Html position={[0, NAME_Y, 0]} center transform={false} style={{ pointerEvents: "none" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          padding: "2px 8px",
          borderRadius: "6px",
          background: "rgba(26, 26, 46, 0.85)",
          border: "0.5px solid rgba(58, 58, 90, 0.6)",
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        {/* Status dot */}
        <div
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: statusColor === "#000000" ? "#6b7280" : statusColor,
            boxShadow: statusColor !== "#000000" ? `0 0 4px ${statusColor}` : undefined,
          }}
        />
        <span
          style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: "10px",
            fontWeight: 600,
            color: "#ffffff",
            lineHeight: "14px",
          }}
        >
          {displayName}
        </span>
      </div>
    </Html>
  );
}

/** Status icon shown floating above head */
function StatusIcon({ status }: { status: VisualAgent["status"] }) {
  if (status === "idle" || status === "offline") return null;

  const iconMap: Record<string, { icon: string; bg: string }> = {
    thinking: { icon: "\u{1F4AD}", bg: "bg-blue-500" },
    speaking: { icon: "\u{1F4AC}", bg: "bg-purple-500" },
    tool_calling: { icon: "\u{1F527}", bg: "bg-orange-500" },
    error: { icon: "\u26A0\uFE0F", bg: "bg-red-500" },
    spawning: { icon: "\u2728", bg: "bg-cyan-500" },
  };

  const info = iconMap[status];
  if (!info) return null;

  return (
    <Html position={[0, CHAR_TOP + 0.1, 0]} center transform={false} style={{ pointerEvents: "none" }}>
      <div
        className={`flex h-5 w-5 items-center justify-center rounded-full ${info.bg} text-[10px] shadow-lg`}
        style={{ animation: "pulse 2s ease-in-out infinite" }}
      >
        {info.icon}
      </div>
    </Html>
  );
}

/** Shadow blob projected on ground plane — sized for bigger characters */
function ShadowBlob({ opacity = 0.2 }: { opacity?: number }) {
  return (
    <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.5, 1]}>
      <circleGeometry args={[0.25, 24]} />
      <meshBasicMaterial color="#000000" transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

/** Spawn particle burst effect */
function SpawnParticles({ active }: { active: boolean }) {
  const particlesRef = useRef<THREE.Points>(null);
  const startTime = useRef(0);
  const started = useRef(false);

  const { positions, velocities } = useMemo(() => {
    const count = 20;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 1.5 + Math.random() * 2;
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0.3;
      pos[i * 3 + 2] = 0;
      vel[i * 3] = Math.cos(angle) * speed;
      vel[i * 3 + 1] = 2 + Math.random() * 2;
      vel[i * 3 + 2] = Math.sin(angle) * speed;
    }
    return { positions: pos, velocities: vel };
  }, []);

  useFrame((state) => {
    if (!particlesRef.current) return;
    if (active && !started.current) {
      started.current = true;
      startTime.current = state.clock.elapsedTime;
    }
    if (!started.current) return;

    const elapsed = state.clock.elapsedTime - startTime.current;
    if (elapsed > 1.0) {
      particlesRef.current.visible = false;
      return;
    }

    const posAttr = particlesRef.current.geometry.getAttribute("position");
    const count = positions.length / 3;
    for (let i = 0; i < count; i++) {
      (posAttr.array as Float32Array)[i * 3] = velocities[i * 3] * elapsed;
      (posAttr.array as Float32Array)[i * 3 + 1] = 0.3 + velocities[i * 3 + 1] * elapsed - 4.9 * elapsed * elapsed;
      (posAttr.array as Float32Array)[i * 3 + 2] = velocities[i * 3 + 2] * elapsed;
    }
    posAttr.needsUpdate = true;

    const mat = particlesRef.current.material as THREE.PointsMaterial;
    mat.opacity = 1 - elapsed;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions.slice(), 3]}
          count={positions.length / 3}
        />
      </bufferGeometry>
      <pointsMaterial color="#60a5fa" size={0.06} transparent opacity={1} depthWrite={false} />
    </points>
  );
}

/** Animated speech bubble — matches 2D PixiAgent dark frosted style */
function SpeechBubbleOverlay({ text }: { text: string }) {
  const truncated = text.length > 100 ? text.slice(0, 97) + "..." : text;
  return (
    <Html position={[0, CHAR_TOP + 0.25, 0]} center transform={false} style={{ pointerEvents: "none" }}>
      <div className="pointer-events-none" style={{ animation: "pulse 3s ease-in-out infinite" }}>
        <div
          style={{
            position: "relative",
            maxWidth: "180px",
            padding: "6px 10px",
            borderRadius: "8px",
            background: "rgba(30, 30, 58, 0.95)",
            border: "1.5px solid rgba(168, 85, 247, 0.6)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            wordBreak: "break-word",
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: "10px",
              lineHeight: "14px",
              color: "#ffffff",
            }}
          >
            {truncated}
          </span>
          {/* Pointer triangle */}
          <div
            style={{
              position: "absolute",
              bottom: "-6px",
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: "10px",
              height: "10px",
              background: "rgba(30, 30, 58, 0.95)",
              borderRight: "1.5px solid rgba(168, 85, 247, 0.6)",
              borderBottom: "1.5px solid rgba(168, 85, 247, 0.6)",
            }}
          />
        </div>
      </div>
    </Html>
  );
}

/** Activity dialogue bubble — shows contextual messages during activities */
function ActivityDialogueBubble({ agentId }: { agentId: string }) {
  const actState = getActivityState();
  if (!actState) return null;

  const dialogue = getAgentDialogue(actState, agentId, 0.1);
  if (!dialogue) return null;

  return (
    <Html position={[0, CHAR_TOP + 0.3, 0]} center transform={false} style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "relative",
          maxWidth: "160px",
          padding: "5px 10px",
          borderRadius: "8px",
          background: "rgba(26, 26, 46, 0.92)",
          border: "1px solid rgba(124, 111, 245, 0.5)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
          animation: "fadeIn 0.3s ease-out",
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: "9px",
            lineHeight: "13px",
            color: "#e0e0e0",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "block",
            maxWidth: "140px",
          }}
        >
          {dialogue}
        </span>
        {/* Small pointer triangle */}
        <div
          style={{
            position: "absolute",
            bottom: "-5px",
            left: "50%",
            transform: "translateX(-50%) rotate(45deg)",
            width: "8px",
            height: "8px",
            background: "rgba(26, 26, 46, 0.92)",
            borderRight: "1px solid rgba(124, 111, 245, 0.5)",
            borderBottom: "1px solid rgba(124, 111, 245, 0.5)",
          }}
        />
      </div>
    </Html>
  );
}

/** Shows a small chat/activity indicator when agents interact */
function InteractionBubble({ agentId }: { agentId: string }) {
  const actState = getActivityState();
  const tickResult = getLastTickResult();
  if (!actState || !tickResult) return null;

  const actType = getAgentActivityType(actState, agentId);
  if (!actType) return null;

  const isSpeaking = tickResult.speakingAgents.has(agentId);
  const isSitting = tickResult.sittingAgents.has(agentId);
  const isDrinking = tickResult.drinkingAgents.has(agentId);
  const isOnPhone = tickResult.phoneAgents?.has(agentId);
  const isWhiteboarding = tickResult.whiteboardingAgents?.has(agentId);
  const isStretching = tickResult.stretchingAgents?.has(agentId);
  const isPresenting = tickResult.presentingAgents?.has(agentId);
  const isReviewing = tickResult.reviewingAgents?.has(agentId);

  let icon = "";
  let bgColor = "rgba(59, 130, 246, 0.8)";

  if (isPresenting) {
    icon = "📊";
    bgColor = "rgba(168, 85, 247, 0.9)";
  } else if (isOnPhone) {
    icon = "📱";
    bgColor = "rgba(34, 197, 94, 0.9)";
  } else if (isWhiteboarding) {
    icon = "📝";
    bgColor = "rgba(249, 115, 22, 0.9)";
  } else if (isStretching) {
    icon = "🧘";
    bgColor = "rgba(59, 130, 246, 0.8)";
  } else if (isReviewing) {
    icon = "👀";
    bgColor = "rgba(139, 92, 246, 0.9)";
  } else if (isSpeaking) {
    icon = "💬";
    bgColor = "rgba(168, 85, 247, 0.9)";
  } else if (isDrinking) {
    icon = "☕";
    bgColor = "rgba(217, 119, 6, 0.9)";
  } else if (isSitting) {
    icon = "🛋️";
    bgColor = "rgba(99, 102, 241, 0.9)";
  } else if (actType === "meeting") {
    icon = "📋";
  } else if (actType === "waterCooler") {
    icon = "🚰";
  } else {
    return null;
  }

  return (
    <Html position={[0, CHAR_TOP + 0.15, 0]} center transform={false} style={{ pointerEvents: "none" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          background: bgColor,
          fontSize: "12px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
          animation: isSpeaking ? "pulse 1.5s ease-in-out infinite" : undefined,
        }}
      >
        {icon}
      </div>
    </Html>
  );
}

export function AgentCharacter({ agent }: AgentCharacterProps) {
  const { t } = useTranslation("common");
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const glowRef = useRef<Mesh>(null);
  const selectionRingRef = useRef<Mesh>(null);
  const spawnElapsed = useRef(0);
  const spawnDone = useRef(!agent.isSubAgent);
  const moveDirRef = useRef<{ dx: number; dz: number } | null>(null);
  const selectAgent = useOfficeStore((s) => s.selectAgent);
  const selectedAgentId = useOfficeStore((s) => s.selectedAgentId);
  const [hovered, setHovered] = useState(false);

  const isSelected = selectedAgentId === agent.id;
  const isSubAgent = agent.isSubAgent;
  const isOffline = agent.status === "offline";

  const isPlaceholder = agent.isPlaceholder;
  const isUnconfirmed = !agent.confirmed;
  const isWalking = agent.movement !== null;
  const tickMovement = useOfficeStore((s) => s.tickMovement);

  const bodyOpacity = isPlaceholder ? 0.25 : isUnconfirmed ? 0.35 : isOffline ? 0.4 : isSubAgent ? 0.6 : 1;

  const glowColor = statusGlowColor(agent.status);
  const glowIntensity = statusGlowIntensity(agent.status);
  const characterScale = isSubAgent ? 0.8 : 1;

  const [targetX, , targetZ] = position2dTo3d(agent.position);

  useFrame((state, delta) => {
    if (!groupRef.current) {
      return;
    }
    const t = state.clock.elapsedTime;

    // Spawn scale-in animation for sub-agents (800ms, easeOutBack)
    if (!spawnDone.current) {
      spawnElapsed.current += delta;
      const progress = Math.min(spawnElapsed.current / 0.8, 1);
      const scale = easeOutBack(progress) * characterScale;
      groupRef.current.scale.setScalar(scale);
      if (progress >= 1) {
        spawnDone.current = true;
      }
      return;
    }

    // Animate glow intensity
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial;
      const targetIntensity = glowIntensity + Math.sin(t * 3) * 0.15;
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, targetIntensity, 0.1);
    }

    // Animate selection ring rotation
    if (selectionRingRef.current) {
      selectionRingRef.current.rotation.z = t * 1.5;
    }

    // Walking animation: tick store, use slower lerp for visible movement
    if (isWalking) {
      tickMovement(agent.id, delta);

      const curAgent = useOfficeStore.getState().agents.get(agent.id);
      if (curAgent) {
        const [wx, , wz] = position2dTo3d(curAgent.position);
        const walkLerp = Math.min(2.5 * delta, 0.1);
        const pos = groupRef.current.position;

        // Track movement direction for sprite animation
        const dx = wx - pos.x;
        const dz = wz - pos.z;
        if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
          moveDirRef.current = { dx, dz };
        }

        pos.x += dx * walkLerp;
        pos.z += dz * walkLerp;

        // Walk bounce on the body group
        if (bodyRef.current) {
          bodyRef.current.position.y = Math.abs(Math.sin(t * 8)) * 0.03;
        }
      }
    } else {
      // Normal smooth position lerp
      const lerpFactor = 1 - Math.pow(0.05, delta);
      const pos = groupRef.current.position;
      const dx = targetX - pos.x;
      const dz = targetZ - pos.z;
      if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
        moveDirRef.current = { dx, dz };
      }
      pos.x += dx * lerpFactor;
      pos.z += dz * lerpFactor;

      // Check if agent should face another agent (interaction)
      const actState = getActivityState();
      if (actState) {
        const facingTargetId = getAgentFacingTarget(actState, agent.id);
        if (facingTargetId) {
          const targetAgent = useOfficeStore.getState().agents.get(facingTargetId);
          if (targetAgent) {
            const [tx, , tz] = position2dTo3d(targetAgent.position);
            const dx = tx - groupRef.current.position.x;
            const dz = tz - groupRef.current.position.z;
            if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
              moveDirRef.current = { dx, dz };
            }
          }
        } else {
          moveDirRef.current = null;
        }
      } else {
        moveDirRef.current = null;
      }

      // Idle breathing
      if (bodyRef.current) {
        bodyRef.current.position.y = Math.sin(t * 2) * 0.02;
      }
    }

    if (isSubAgent && !isPlaceholder) {
      const pulse = characterScale * (1.0 + Math.sin(t * 3) * 0.05);
      groupRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group
      ref={groupRef}
      position={[targetX, 0, targetZ]}
      scale={isSubAgent && !spawnDone.current ? 0 : characterScale}
      onClick={(e) => {
        e.stopPropagation();
        if (!isPlaceholder) selectAgent(agent.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (!isPlaceholder) {
          setHovered(true);
          document.body.style.cursor = "pointer";
        }
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      {/* Shadow blob on ground */}
      <ShadowBlob opacity={isPlaceholder ? 0.05 : 0.18} />

      {/* Spawn particle burst */}
      {isSubAgent && <SpawnParticles active={spawnDone.current} />}

      <group ref={bodyRef}>
        {/* Status emissive glow shell behind sprite */}
        {glowIntensity > 0 && (
          <mesh ref={glowRef} position={[0, 0.5, -0.05]}>
            <planeGeometry args={[0.9, 0.9]} />
            <meshStandardMaterial
              color={glowColor}
              emissive={glowColor}
              emissiveIntensity={glowIntensity}
              transparent
              opacity={0.2}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Sprite character — billboarded pixel art from sprite sheet */}
        <Suspense fallback={null}>
          <SpriteCharacter
            agentId={agent.id}
            isWalking={isWalking}
            moveDirection={moveDirRef.current}
            scale={characterScale}
            opacity={bodyOpacity}
            tint={isOffline || isPlaceholder || isUnconfirmed ? "#888888" : undefined}
            isActive={agent.status === "thinking" || agent.status === "speaking" || agent.status === "tool_calling" || agent.status === "spawning"}
            zone={agent.zone}
          />
        </Suspense>

        {/* Sub-agent "S" badge */}
        {isSubAgent && !isPlaceholder && (
          <Html position={[0.25, 0.9, 0.1]} center transform={false} style={{ pointerEvents: "none" }}>
            <div
              style={{
                display: "flex",
                width: "14px",
                height: "14px",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "#06b6d4",
                border: "2px solid #1a1a2e",
                fontSize: "8px",
                fontWeight: "bold",
                color: "#ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }}
            >
              S
            </div>
          </Html>
        )}
      </group>

      {/* Permanent name plate below character — matches 2D style */}
      <NamePlate name={agent.name} status={agent.status} />

      {/* Status icon floating above head */}
      <StatusIcon status={agent.status} />

      {agent.status === "thinking" && <ThinkingIndicator />}
      {agent.status === "tool_calling" && agent.currentTool && (
        <SkillHologram tool={{ name: agent.currentTool.name }} position={[0.35, 0.5, -0.25]} />
      )}
      {agent.status === "error" && <ErrorIndicator />}

      {/* Speaking: animated speech bubble with text */}
      {agent.status === "speaking" && agent.speechBubble && (
        <SpeechBubbleOverlay text={agent.speechBubble.text ?? ""} />
      )}

      {/* Interaction chat bubble — agent is "speaking" during a meeting/chat activity */}
      {agent.status === "idle" && <InteractionBubble agentId={agent.id} />}

      {/* Activity dialogue bubble — contextual messages during activities */}
      {agent.status === "idle" && <ActivityDialogueBubble agentId={agent.id} />}

      {/* Selection ring — bright pulsing ring on ground */}
      {isSelected && (
        <group>
          <mesh ref={selectionRingRef} position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.25, 0.32, 32]} />
            <meshStandardMaterial
              color="#3b82f6"
              emissive="#3b82f6"
              emissiveIntensity={1.2}
              transparent
              opacity={0.9}
            />
          </mesh>
          {/* Outer glow ring */}
          <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.32, 0.40, 32]} />
            <meshStandardMaterial
              color="#3b82f6"
              emissive="#3b82f6"
              emissiveIntensity={0.5}
              transparent
              opacity={0.3}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

      {hovered && (
        <Html position={[0, CHAR_TOP + 0.05, 0]} center transform={false} style={{ pointerEvents: "none" }}>
          <div
            style={{
              whiteSpace: "nowrap",
              padding: "3px 8px",
              borderRadius: "6px",
              background: "rgba(26, 26, 46, 0.92)",
              border: "1px solid rgba(58, 58, 90, 0.6)",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: "11px",
              color: "#ffffff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              pointerEvents: "none",
            }}
          >
            {agent.name} — {t(`agent.statusLabels.${agent.status}`)}
          </div>
        </Html>
      )}
    </group>
  );
}
