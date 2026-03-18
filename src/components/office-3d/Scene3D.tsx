import { OrbitControls, Html } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
} from "@react-three/postprocessing";
import { useMemo, useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { ZONES } from "@/lib/constants";
import { position2dTo3d } from "@/lib/position-allocator";
import { detectMeetingGroups } from "@/store/meeting-manager";
import { useOfficeStore } from "@/store/office-store";
import type { CameraMode } from "@/gateway/types";
import { AgentCharacter } from "./AgentCharacter";
import { Environment3D } from "./Environment3D";
import { OfficeLayout3D } from "./OfficeLayout3D";
import { ParentChildLine } from "./ParentChildLine";

const SCENE_CENTER: [number, number, number] = [8, 0, 6];
const BG_LIGHT = new THREE.Color("#e8ecf2");
const BG_DARK = new THREE.Color("#0f1729");

/* ── Camera preset configs ────────────────────────────────── */

const OVERVIEW_POS = new THREE.Vector3(22, 15, 22);
const OVERVIEW_TARGET = new THREE.Vector3(8, 0, 6);

const FOLLOW_OFFSET = new THREE.Vector3(0, 6, 8); // behind + above
const FOLLOW_LERP = 0.03;

const CINEMATIC_CENTER = new THREE.Vector3(8, 0, 6);
const CINEMATIC_RADIUS = 20;
const CINEMATIC_SPEED = 0.1; // rad/s
const CINEMATIC_HEIGHT_MIN = 14;
const CINEMATIC_HEIGHT_MAX = 18;

const FIRST_PERSON_EYE_Y = 1.2;
const FIRST_PERSON_FOV = 65;
const DEFAULT_FOV = 42;

/* ── Meeting table label overlay ─────────────────────────── */

const MEETING_TABLE_CENTERS_2D = [
  { x: ZONES.meeting.x + ZONES.meeting.width / 2, y: ZONES.meeting.y + ZONES.meeting.height / 2 },
  {
    x: ZONES.meeting.x + ZONES.meeting.width * 0.25,
    y: ZONES.meeting.y + ZONES.meeting.height * 0.3,
  },
  {
    x: ZONES.meeting.x + ZONES.meeting.width * 0.75,
    y: ZONES.meeting.y + ZONES.meeting.height * 0.7,
  },
];

function MeetingLabels() {
  const agents = useOfficeStore((s) => s.agents);
  const links = useOfficeStore((s) => s.links);

  const groups = useMemo(() => detectMeetingGroups(links, agents), [links, agents]);

  if (groups.length === 0) {
    return null;
  }

  return (
    <>
      {groups.map((group, i) => {
        const center = MEETING_TABLE_CENTERS_2D[i % MEETING_TABLE_CENTERS_2D.length];
        const [cx, , cz] = position2dTo3d(center);
        const names = group.agentIds.map((id) => agents.get(id)?.name ?? id.slice(0, 6)).join(", ");

        return (
          <Html
            key={group.sessionKey}
            position={[cx, 2, cz]}
            center
            transform={false}
            style={{ pointerEvents: "none" }}
          >
            <div className="pointer-events-none rounded bg-blue-600/80 px-2 py-1 text-[10px] text-white shadow whitespace-nowrap">
              {names}
            </div>
          </Html>
        );
      })}
    </>
  );
}

/* ── Background color sync ───────────────────────────────── */

function BackgroundSync() {
  const theme = useOfficeStore((s) => s.theme);
  const { gl } = useThree();
  const colorRef = useRef(new THREE.Color(theme === "light" ? BG_LIGHT : BG_DARK));

  useEffect(() => {
    gl.setClearColor(colorRef.current);
    // ACES Filmic tone mapping for richer colors
    gl.toneMapping = THREE.ACESFilmicToneMapping;
  }, [gl]);

  useFrame(() => {
    const target = theme === "light" ? BG_LIGHT : BG_DARK;
    colorRef.current.lerp(target, 0.05);
    gl.setClearColor(colorRef.current);
    // Smooth exposure transition based on theme
    const targetExposure = theme === "light" ? 1.1 : 0.9;
    gl.toneMappingExposure = THREE.MathUtils.lerp(gl.toneMappingExposure, targetExposure, 0.05);
  });

  return null;
}

/* ── Camera controller (driven by cameraMode) ───────────── */

function CameraController() {
  const cameraMode = useOfficeStore((s) => s.cameraMode);
  const selectedAgentId = useOfficeStore((s) => s.selectedAgentId);
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  // Smooth intermediary vectors
  const smoothPos = useRef(new THREE.Vector3().copy(camera.position));
  const smoothTarget = useRef(new THREE.Vector3(...SCENE_CENTER));
  const cinematicAngle = useRef(0);

  // Helper: get selected agent 3D position
  const getSelectedAgentPos = useCallback((): THREE.Vector3 | null => {
    if (!selectedAgentId) return null;
    const agent = useOfficeStore.getState().agents.get(selectedAgentId);
    if (!agent) return null;
    const [x, , z] = position2dTo3d(agent.position);
    return new THREE.Vector3(x, 0, z);
  }, [selectedAgentId]);

  useFrame((state, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const t = state.clock.elapsedTime;

    switch (cameraMode) {
      case "overview": {
        // Lerp camera to overview position
        smoothPos.current.lerp(OVERVIEW_POS, 0.03);
        smoothTarget.current.lerp(OVERVIEW_TARGET, 0.03);
        camera.position.copy(smoothPos.current);
        controls.target.copy(smoothTarget.current);
        controls.enabled = true;
        controls.autoRotate = false;

        // Reset FOV smoothly
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.fov = THREE.MathUtils.lerp(camera.fov, DEFAULT_FOV, 0.05);
          camera.updateProjectionMatrix();
        }
        break;
      }

      case "follow": {
        const agentPos = getSelectedAgentPos();
        if (!agentPos) {
          // Fallback to overview
          smoothPos.current.lerp(OVERVIEW_POS, 0.03);
          smoothTarget.current.lerp(OVERVIEW_TARGET, 0.03);
          camera.position.copy(smoothPos.current);
          controls.target.copy(smoothTarget.current);
        } else {
          const desiredTarget = agentPos.clone();
          desiredTarget.y = 1.0;
          const desiredPos = agentPos.clone().add(FOLLOW_OFFSET);

          smoothTarget.current.lerp(desiredTarget, FOLLOW_LERP);
          smoothPos.current.lerp(desiredPos, FOLLOW_LERP);

          camera.position.copy(smoothPos.current);
          controls.target.copy(smoothTarget.current);
        }
        controls.enabled = true;
        controls.autoRotate = false;

        if (camera instanceof THREE.PerspectiveCamera) {
          camera.fov = THREE.MathUtils.lerp(camera.fov, DEFAULT_FOV, 0.05);
          camera.updateProjectionMatrix();
        }
        break;
      }

      case "cinematic": {
        cinematicAngle.current += CINEMATIC_SPEED * delta;
        const angle = cinematicAngle.current;
        const height = (CINEMATIC_HEIGHT_MIN + CINEMATIC_HEIGHT_MAX) / 2 +
          ((CINEMATIC_HEIGHT_MAX - CINEMATIC_HEIGHT_MIN) / 2) * Math.sin(t * 0.15);

        const desiredPos = new THREE.Vector3(
          CINEMATIC_CENTER.x + Math.cos(angle) * CINEMATIC_RADIUS,
          height,
          CINEMATIC_CENTER.z + Math.sin(angle) * CINEMATIC_RADIUS,
        );
        const desiredTarget = CINEMATIC_CENTER.clone();
        desiredTarget.y = 1;

        smoothPos.current.lerp(desiredPos, 0.02);
        smoothTarget.current.lerp(desiredTarget, 0.02);

        camera.position.copy(smoothPos.current);
        controls.target.copy(smoothTarget.current);

        // Disable manual orbit in cinematic mode
        controls.enabled = false;

        if (camera instanceof THREE.PerspectiveCamera) {
          camera.fov = THREE.MathUtils.lerp(camera.fov, DEFAULT_FOV, 0.05);
          camera.updateProjectionMatrix();
        }
        break;
      }

      case "firstPerson": {
        const agentPos = getSelectedAgentPos();
        if (!agentPos) {
          // Fallback to overview
          smoothPos.current.lerp(OVERVIEW_POS, 0.03);
          smoothTarget.current.lerp(OVERVIEW_TARGET, 0.03);
          camera.position.copy(smoothPos.current);
          controls.target.copy(smoothTarget.current);
          controls.enabled = true;
        } else {
          const desiredPos = agentPos.clone();
          desiredPos.y = FIRST_PERSON_EYE_Y;
          // Slightly behind agent
          desiredPos.z += 0.8;

          // Look forward (toward scene center)
          const desiredTarget = new THREE.Vector3(
            agentPos.x,
            FIRST_PERSON_EYE_Y,
            agentPos.z - 4,
          );

          smoothPos.current.lerp(desiredPos, 0.04);
          smoothTarget.current.lerp(desiredTarget, 0.04);

          camera.position.copy(smoothPos.current);
          controls.target.copy(smoothTarget.current);
          controls.enabled = true;
        }

        if (camera instanceof THREE.PerspectiveCamera) {
          camera.fov = THREE.MathUtils.lerp(camera.fov, FIRST_PERSON_FOV, 0.05);
          camera.updateProjectionMatrix();
        }
        break;
      }
    }

    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableRotate={true}
      enablePan={true}
      enableZoom={true}
      minPolarAngle={Math.PI / 8}
      maxPolarAngle={Math.PI / 2.8}
      minDistance={2}
      maxDistance={40}
      target={SCENE_CENTER}
      enableDamping
      dampingFactor={0.08}
    />
  );
}

/* ── Post-processing effects ─────────────────────────────── */

function PostProcessing() {
  const theme = useOfficeStore((s) => s.theme);
  const isDark = theme === "dark";

  const chromaticOffset = useMemo(() => new THREE.Vector2(0.0008, 0.0008), []);

  if (isDark) {
    return (
      <EffectComposer>
        <Bloom
          intensity={1.5}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.1}
          mipmapBlur
          radius={0.8}
        />
        <Vignette darkness={0.4} offset={0.3} />
        <ChromaticAberration offset={chromaticOffset} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer>
      <Bloom
        intensity={1.5}
        luminanceThreshold={0.4}
        luminanceSmoothing={0.1}
        mipmapBlur
        radius={0.8}
      />
      <Vignette darkness={0.4} offset={0.3} />
    </EffectComposer>
  );
}

/* ── Camera preset overlay buttons ───────────────────────── */

const CAMERA_PRESETS: { mode: CameraMode; icon: string; label: string }[] = [
  { mode: "overview", icon: "\uD83D\uDDFA\uFE0F", label: "Overview" },
  { mode: "follow", icon: "\uD83D\uDC41\uFE0F", label: "Follow" },
  { mode: "cinematic", icon: "\uD83C\uDFAC", label: "Cinematic" },
  { mode: "firstPerson", icon: "\uD83D\uDC64", label: "First Person" },
];

function CameraPresetButtons() {
  const cameraMode = useOfficeStore((s) => s.cameraMode);
  const setCameraMode = useOfficeStore((s) => s.setCameraMode);

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        display: "flex",
        gap: 6,
        zIndex: 20,
        pointerEvents: "auto",
      }}
    >
      {CAMERA_PRESETS.map(({ mode, icon, label }) => {
        const isActive = cameraMode === mode;
        return (
          <button
            key={mode}
            onClick={() => setCameraMode(mode)}
            title={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 10px",
              borderRadius: 20,
              border: isActive ? "1px solid rgba(124, 111, 245, 0.8)" : "1px solid rgba(255,255,255,0.15)",
              background: isActive
                ? "rgba(124, 111, 245, 0.25)"
                : "rgba(15, 23, 41, 0.65)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              color: isActive ? "#c4b5fd" : "#94a3b8",
              fontSize: 12,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontWeight: isActive ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: isActive
                ? "0 0 12px rgba(124, 111, 245, 0.3)"
                : "0 2px 6px rgba(0,0,0,0.2)",
              outline: "none",
            }}
          >
            <span style={{ fontSize: 14 }}>{icon}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Scene content ───────────────────────────────────────── */

function SceneContent() {
  const agents = useOfficeStore((s) => s.agents);
  const theme = useOfficeStore((s) => s.theme);
  const bloomEnabled = useOfficeStore((s) => s.bloomEnabled);
  const agentList = Array.from(agents.values());

  return (
    <>
      <BackgroundSync />
      <CameraController />
      <Environment3D theme={theme} />
      <OfficeLayout3D />
      {agentList.map((agent) => (
        <AgentCharacter key={agent.id} agent={agent} />
      ))}
      {agentList
        .filter((a) => a.isSubAgent && a.parentAgentId)
        .map((child) => {
          const parent = agents.get(child.parentAgentId!);
          if (!parent) {
            return null;
          }
          return <ParentChildLine key={`line-${child.id}`} parent={parent} child={child} />;
        })}
      <MeetingLabels />
      {bloomEnabled && <PostProcessing />}
    </>
  );
}

/* ── Main export ─────────────────────────────────────────── */

export default function Scene3D() {
  return (
    <div className="h-full w-full" style={{ position: "relative" }}>
      <Canvas
        gl={{ antialias: true, alpha: false }}
        shadows
        camera={{
          fov: DEFAULT_FOV,
          position: [22, 15, 22],
          near: 0.1,
          far: 200,
        }}
      >
        <SceneContent />
      </Canvas>
      <CameraPresetButtons />
    </div>
  );
}
