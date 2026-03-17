import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import * as THREE from "three";

import type { Group, Mesh } from "three";
import type { VisualAgent } from "@/gateway/types";
import { generateAvatar3dColor } from "@/lib/avatar-generator";
import { position2dTo3d } from "@/lib/position-allocator";
import { useOfficeStore } from "@/store/office-store";
import { ErrorIndicator } from "./ErrorIndicator";
import { SkillHologram } from "./SkillHologram";
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
    <Html position={[0, 1.05, 0]} center transform={false} style={{ pointerEvents: "none" }}>
      <div
        className={`flex h-5 w-5 items-center justify-center rounded-full ${info.bg} text-[10px] shadow-lg`}
        style={{ animation: "pulse 2s ease-in-out infinite" }}
      >
        {info.icon}
      </div>
    </Html>
  );
}

/** Shadow blob projected on ground plane */
function ShadowBlob({ opacity = 0.2 }: { opacity?: number }) {
  return (
    <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.22, 24]} />
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

/** Animated speech bubble */
function SpeechBubbleOverlay({ text }: { text: string }) {
  const truncated = text.length > 60 ? text.slice(0, 57) + "..." : text;
  return (
    <Html position={[0, 1.2, 0]} center transform={false} style={{ pointerEvents: "none" }}>
      <div
        className="pointer-events-none animate-bounce"
        style={{ animationDuration: "3s", animationIterationCount: "infinite" }}
      >
        <div
          className="relative max-w-[180px] rounded-lg bg-purple-600/90 px-3 py-1.5 text-[10px] leading-tight text-white shadow-lg backdrop-blur-sm"
          style={{ wordBreak: "break-word" }}
        >
          {truncated}
          <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-purple-600/90" />
        </div>
      </div>
    </Html>
  );
}

export function AgentCharacter({ agent }: AgentCharacterProps) {
  const { t } = useTranslation("common");
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const leftHandRef = useRef<Mesh>(null);
  const rightHandRef = useRef<Mesh>(null);
  const glowRef = useRef<Mesh>(null);
  const selectionRingRef = useRef<Mesh>(null);
  const spawnElapsed = useRef(0);
  const spawnDone = useRef(!agent.isSubAgent);
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

  const baseColor = isSubAgent ? "#60a5fa" : generateAvatar3dColor(agent.id);
  const bodyOpacity = isPlaceholder ? 0.25 : isUnconfirmed ? 0.35 : isOffline ? 0.4 : isSubAgent ? 0.6 : 1;
  const displayColor = isOffline || isPlaceholder || isUnconfirmed ? "#6b7280" : baseColor;

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
        pos.x += (wx - pos.x) * walkLerp;
        pos.z += (wz - pos.z) * walkLerp;

        // Walk body sway +-0.08 rad at 8Hz
        if (bodyRef.current) {
          bodyRef.current.rotation.z = Math.sin(t * 8 * Math.PI * 2) * 0.08;
          // Walk bounce
          bodyRef.current.position.y = Math.abs(Math.sin(t * 8)) * 0.03;
        }

        // Arm swing while walking
        if (leftHandRef.current && rightHandRef.current) {
          const armSwing = Math.sin(t * 8 * Math.PI * 2) * 0.15;
          leftHandRef.current.position.z = armSwing;
          rightHandRef.current.position.z = -armSwing;
        }
      }
    } else {
      // Normal smooth position lerp
      const lerpFactor = 1 - Math.pow(0.05, delta);
      const pos = groupRef.current.position;
      pos.x += (targetX - pos.x) * lerpFactor;
      pos.z += (targetZ - pos.z) * lerpFactor;

      // Idle breathing
      if (bodyRef.current) {
        bodyRef.current.position.y = Math.sin(t * 2) * 0.02;
        bodyRef.current.rotation.z = 0;
      }

      // Reset hands to neutral position when idle
      if (leftHandRef.current && rightHandRef.current) {
        leftHandRef.current.position.z = THREE.MathUtils.lerp(leftHandRef.current.position.z, 0, 0.1);
        rightHandRef.current.position.z = THREE.MathUtils.lerp(rightHandRef.current.position.z, 0, 0.1);
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
        {/* Status emissive glow shell (slightly larger, transparent) */}
        {glowIntensity > 0 && (
          <mesh ref={glowRef} position={[0, 0.35, 0]}>
            <capsuleGeometry args={[0.18, 0.44, 8, 16]} />
            <meshStandardMaterial
              color={glowColor}
              emissive={glowColor}
              emissiveIntensity={glowIntensity}
              transparent
              opacity={0.15}
              depthWrite={false}
              side={THREE.BackSide}
            />
          </mesh>
        )}

        {/* Body capsule */}
        <mesh position={[0, 0.35, 0]} castShadow>
          <capsuleGeometry args={[0.15, 0.4, 8, 16]} />
          <meshStandardMaterial
            color={displayColor}
            emissive={glowColor}
            emissiveIntensity={glowIntensity * 0.3}
            transparent={bodyOpacity < 1}
            opacity={bodyOpacity}
          />
        </mesh>

        {/* Head sphere */}
        <mesh position={[0, 0.7, 0]} castShadow>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial
            color={displayColor}
            emissive={glowColor}
            emissiveIntensity={glowIntensity * 0.2}
            transparent={bodyOpacity < 1}
            opacity={bodyOpacity}
          />
        </mesh>

        {/* Arm / hand spheres for walking animation */}
        <mesh ref={leftHandRef} position={[-0.2, 0.3, 0]} castShadow>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial
            color={displayColor}
            transparent={bodyOpacity < 1}
            opacity={bodyOpacity}
          />
        </mesh>
        <mesh ref={rightHandRef} position={[0.2, 0.3, 0]} castShadow>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial
            color={displayColor}
            transparent={bodyOpacity < 1}
            opacity={bodyOpacity}
          />
        </mesh>

        {/* Sub-agent "S" badge */}
        {isSubAgent && !isPlaceholder && (
          <Html position={[0.15, 0.7, 0.1]} center transform={false} style={{ pointerEvents: "none" }}>
            <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-400 text-[8px] font-bold text-white shadow">
              S
            </div>
          </Html>
        )}
      </group>

      {/* Status icon floating above head */}
      <StatusIcon status={agent.status} />

      {agent.status === "thinking" && <ThinkingIndicator />}
      {agent.status === "tool_calling" && agent.currentTool && (
        <SkillHologram tool={{ name: agent.currentTool.name }} position={[0.3, 0.5, -0.3]} />
      )}
      {agent.status === "error" && <ErrorIndicator />}

      {/* Speaking: animated speech bubble with text */}
      {agent.status === "speaking" && agent.speechBubble && (
        <SpeechBubbleOverlay text={agent.speechBubble.text ?? ""} />
      )}

      {/* Selection ring — bright pulsing ring on ground */}
      {isSelected && (
        <group>
          <mesh ref={selectionRingRef} position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.28, 0.34, 32]} />
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
            <ringGeometry args={[0.34, 0.42, 32]} />
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
        <Html position={[0, 1.1, 0]} center transform={false} style={{ pointerEvents: "none" }}>
          <div className="pointer-events-none whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-[11px] text-white shadow">
            {agent.name} — {t(`agent.statusLabels.${agent.status}`)}
          </div>
        </Html>
      )}
    </group>
  );
}
