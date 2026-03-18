import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { ThemeMode } from "@/gateway/types";
import { useOfficeStore } from "@/store/office-store";

// ═══════════════════════════════════════════════════════════
// Open playground 3D environment — no walls, clean space
// Gather.town-style open world feel
// ═══════════════════════════════════════════════════════════

const LERP_SPEED = 4;

const LIGHT_PARAMS = {
  ambient: { intensity: 0.65, color: new THREE.Color("#f5f0e8") },
  main: { intensity: 1.2, color: new THREE.Color("#fff8ee") },
  fill: { intensity: 0.4, color: new THREE.Color("#dde4f0") },
  hemi: { intensity: 0.4 },
} as const;

const DARK_PARAMS = {
  ambient: { intensity: 0.25, color: new THREE.Color("#1a1a2e") },
  main: { intensity: 0.5, color: new THREE.Color("#8899bb") },
  fill: { intensity: 0.2, color: new THREE.Color("#2a2a4a") },
  hemi: { intensity: 0.2 },
} as const;

function ThemeLighting({ theme }: { theme: ThemeMode }) {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const mainRef = useRef<THREE.DirectionalLight>(null);
  const fillRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);

  const target = theme === "light" ? LIGHT_PARAMS : DARK_PARAMS;

  useFrame((_, delta) => {
    const t = Math.min(delta * LERP_SPEED, 1);
    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.lerp(ambientRef.current.intensity, target.ambient.intensity, t);
      ambientRef.current.color.lerp(target.ambient.color, t);
    }
    if (mainRef.current) {
      mainRef.current.intensity = THREE.MathUtils.lerp(mainRef.current.intensity, target.main.intensity, t);
      mainRef.current.color.lerp(target.main.color, t);
    }
    if (fillRef.current) {
      fillRef.current.intensity = THREE.MathUtils.lerp(fillRef.current.intensity, target.fill.intensity, t);
      fillRef.current.color.lerp(target.fill.color, t);
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = THREE.MathUtils.lerp(hemiRef.current.intensity, target.hemi.intensity, t);
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.65} color="#f5f0e8" />
      <directionalLight
        ref={mainRef}
        position={[12, 18, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.001}
        color="#fff8ee"
      />
      <directionalLight ref={fillRef} position={[-8, 10, -5]} intensity={0.4} color="#dde4f0" />
      <hemisphereLight ref={hemiRef} args={["#e0e8f5", "#b0a090", 0.4]} />
      {theme === "dark" && (
        <>
          <pointLight position={[3, 1.5, 2]} intensity={0.6} color="#ffd599" distance={6} decay={2} />
          <pointLight position={[12, 1.5, 4]} intensity={0.6} color="#ffd599" distance={6} decay={2} />
          <pointLight position={[6, 1.5, 10]} intensity={0.4} color="#ffd599" distance={5} decay={2} />
          <pointLight position={[12, 1.5, 9]} intensity={0.4} color="#c4b5fd" distance={5} decay={2} />
        </>
      )}
    </>
  );
}

/** Floating ambient particles */
function AmbientParticles({ theme }: { theme: ThemeMode }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 100;

  const { positions, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * 16;
      pos[i * 3 + 1] = 0.3 + Math.random() * 3;
      pos[i * 3 + 2] = Math.random() * 12;
      spd[i] = 0.2 + Math.random() * 0.5;
    }
    return { positions: pos, speeds: spd };
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const t = state.clock.elapsedTime;
    const posAttr = pointsRef.current.geometry.getAttribute("position");
    for (let i = 0; i < count; i++) {
      const baseY = 0.3 + ((i * 3) / count) * 2.5;
      (posAttr.array as Float32Array)[i * 3 + 1] = baseY + Math.sin(t * speeds[i] + i) * 0.4;
      (posAttr.array as Float32Array)[i * 3] += Math.sin(t * 0.08 + i * 0.5) * 0.001;
    }
    posAttr.needsUpdate = true;
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = 0.35 + Math.sin(t * 0.5) * 0.1;
  });

  const particleColor = theme === "dark" ? "#ffd700" : "#c0c8d8";
  const particleSize = theme === "dark" ? 0.045 : 0.03;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions.slice(), 3]} count={count} />
      </bufferGeometry>
      <pointsMaterial
        color={particleColor}
        size={particleSize}
        transparent
        opacity={0.4}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/** Subtle zone edge glow strips on the ground */
function ZoneEdgeGlow({ position, length, axis = "z" }: { position: [number, number, number]; length: number; axis?: "x" | "z" }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.15;
  });

  const size: [number, number, number] = axis === "z" ? [0.04, 0.02, length] : [length, 0.02, 0.04];

  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#7c6ff5" emissive="#7c6ff5" emissiveIntensity={0.3} transparent opacity={0.6} />
    </mesh>
  );
}

/** Activity-responsive ambient light */
function ActivityAmbientLight() {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (!lightRef.current) return;
    const agents = useOfficeStore.getState().agents;
    let activeCount = 0;
    agents.forEach((a) => {
      if (a.status === "thinking" || a.status === "tool_calling" || a.status === "speaking") {
        activeCount++;
      }
    });
    const targetIntensity = 0.1 + Math.min(activeCount * 0.08, 0.5);
    lightRef.current.intensity = THREE.MathUtils.lerp(lightRef.current.intensity, targetIntensity, 0.05);
    const warmth = Math.min(activeCount / 8, 1);
    lightRef.current.color.setRGB(0.9 + warmth * 0.1, 0.85 - warmth * 0.1, 0.75 - warmth * 0.2);
  });

  return <pointLight ref={lightRef} position={[8, 3, 6]} intensity={0.1} distance={20} decay={1} />;
}

export function Environment3D({ theme = "dark" as ThemeMode }: { theme?: ThemeMode }) {
  const isDark = theme === "dark";
  const floorColor = isDark ? "#2d2d44" : "#d4dbe6";
  const platformColor = isDark ? "#1a1a2e" : "#bcc4d0";
  const gridColor1 = isDark ? "#3a3a5a" : "#c0c8d4";
  const gridColor2 = isDark ? "#2a2a42" : "#cad2dc";

  return (
    <group>
      <ThemeLighting theme={theme} />
      <ActivityAmbientLight />

      {/* Subtle distance fog */}
      <fog attach="fog" args={[isDark ? "#0d0d1a" : "#e8ecf2", 20, 60]} />

      {/* Ambient particles */}
      <AmbientParticles theme={theme} />

      {/* === Ground — open playground, no walls === */}
      
      {/* Extended ground plane (infinite feel) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8, -0.1, 6]} receiveShadow>
        <planeGeometry args={[40, 30]} />
        <meshStandardMaterial color={isDark ? "#0d0d1a" : "#b0b8c8"} roughness={0.95} />
      </mesh>

      {/* Main platform (raised slightly) */}
      <mesh position={[8, -0.02, 6]}>
        <boxGeometry args={[17, 0.04, 13]} />
        <meshStandardMaterial color={platformColor} roughness={0.8} />
      </mesh>

      {/* Floor surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8, 0.01, 6]} receiveShadow>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial color={floorColor} roughness={0.4} metalness={0.05} envMapIntensity={0.3} />
      </mesh>

      {/* Floor grid */}
      <gridHelper args={[16, 16, gridColor1, gridColor2]} position={[8, 0.02, 6]} />

      {/* === Zone floor tints (no walls, just colored ground areas) === */}
      {/* Desk zone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.5, 0.015, 2.8]} receiveShadow>
        <planeGeometry args={[6.5, 5]} />
        <meshStandardMaterial color={isDark ? "#3b82f6" : "#4a90d9"} transparent opacity={isDark ? 0.08 : 0.12} roughness={0.85} />
      </mesh>
      {/* Meeting zone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12, 0.015, 2.8]} receiveShadow>
        <planeGeometry args={[6.5, 5]} />
        <meshStandardMaterial color={isDark ? "#a855f7" : "#9060c0"} transparent opacity={isDark ? 0.08 : 0.12} roughness={0.85} />
      </mesh>
      {/* Hot desk zone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.5, 0.015, 9]} receiveShadow>
        <planeGeometry args={[6.5, 5]} />
        <meshStandardMaterial color={isDark ? "#f97316" : "#d08030"} transparent opacity={isDark ? 0.08 : 0.12} roughness={0.85} />
      </mesh>
      {/* Lounge zone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12, 0.015, 9]} receiveShadow>
        <planeGeometry args={[6.5, 5]} />
        <meshStandardMaterial color={isDark ? "#22c55e" : "#40a060"} transparent opacity={isDark ? 0.08 : 0.12} roughness={0.85} />
      </mesh>

      {/* === Zone edge glow lines (replacing walls) === */}
      {/* Vertical divider (desk | meeting) */}
      <ZoneEdgeGlow position={[7.75, 0.03, 3]} length={5.5} axis="z" />
      {/* Vertical divider (hotdesk | lounge) */}
      <ZoneEdgeGlow position={[7.75, 0.03, 9]} length={5.5} axis="z" />
      {/* Horizontal divider (desk/meeting | hotdesk/lounge) */}
      <ZoneEdgeGlow position={[4, 0.03, 5.8]} length={7.5} axis="x" />
      <ZoneEdgeGlow position={[12, 0.03, 5.8]} length={7.5} axis="x" />

      {/* === Platform edge accent === */}
      <mesh position={[8, 0.01, -0.5]}>
        <boxGeometry args={[17, 0.02, 0.04]} />
        <meshStandardMaterial color="#7c6ff5" emissive="#7c6ff5" emissiveIntensity={0.2} transparent opacity={0.5} />
      </mesh>
      <mesh position={[8, 0.01, 12.5]}>
        <boxGeometry args={[17, 0.02, 0.04]} />
        <meshStandardMaterial color="#7c6ff5" emissive="#7c6ff5" emissiveIntensity={0.2} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}
