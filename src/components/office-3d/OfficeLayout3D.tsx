import { Html, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import * as THREE from "three";

const DESK_HEIGHT = 0.48;

// ═══════════════════════════════════════════════════════════
// Richer 3D Office Environment
// Detailed furniture with creative geometry combinations
// ═══════════════════════════════════════════════════════════

/** Animated monitor screen with subtle color cycling */
function AnimatedScreen({
  position,
  size,
  seed = 0,
}: {
  position: [number, number, number];
  size: [number, number];
  seed?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    // Cycle hue subtly based on time + seed for per-monitor variation
    const hue = (0.55 + Math.sin(t * 0.3 + seed) * 0.08 + Math.sin(t * 0.7 + seed * 2) * 0.04);
    const col = new THREE.Color().setHSL(hue, 0.35, 0.75);
    const emCol = new THREE.Color().setHSL(hue, 0.5, 0.5);
    mat.color.lerp(col, 0.1);
    mat.emissive.lerp(emCol, 0.1);
    mat.emissiveIntensity = 0.3 + Math.sin(t * 1.5 + seed) * 0.08;
  });

  return (
    <mesh ref={meshRef} position={position}>
      <planeGeometry args={size} />
      <meshStandardMaterial
        color="#d0e8ff"
        emissive="#90c0f0"
        emissiveIntensity={0.3}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

function Workstation({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Desk surface — light wood */}
      <mesh position={[0, DESK_HEIGHT, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.04, 0.55]} />
        <meshStandardMaterial color="#c4a882" roughness={0.65} metalness={0.02} />
      </mesh>
      {/* Desk legs — metal gray */}
      {[
        [-0.5, DESK_HEIGHT / 2, -0.22],
        [0.5, DESK_HEIGHT / 2, -0.22],
        [-0.5, DESK_HEIGHT / 2, 0.22],
        [0.5, DESK_HEIGHT / 2, 0.22],
      ].map((pos, i) => (
        <mesh key={`leg-${i}`} position={pos as [number, number, number]} castShadow>
          <boxGeometry args={[0.04, DESK_HEIGHT, 0.04]} />
          <meshStandardMaterial color="#8898a8" roughness={0.5} metalness={0.35} />
        </mesh>
      ))}

      {/* Monitor */}
      <group position={[0, DESK_HEIGHT + 0.02, -0.15]}>
        {/* Monitor stand */}
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.06, 0.08, 0.1, 8]} />
          <meshStandardMaterial color="#6b7a8a" roughness={0.4} metalness={0.5} />
        </mesh>
        {/* Monitor pole */}
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.03, 0.2, 0.03]} />
          <meshStandardMaterial color="#7a8a9a" roughness={0.4} metalness={0.5} />
        </mesh>
        {/* Monitor screen frame */}
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[0.55, 0.32, 0.02]} />
          <meshStandardMaterial color="#3a4550" roughness={0.3} metalness={0.15} />
        </mesh>
        {/* Screen glow — animated content with subtle color shift */}
        <AnimatedScreen position={[0, 0.35, 0.015]} size={[0.48, 0.26]} seed={position[0] * 7 + position[2] * 13} />
      </group>

      {/* Keyboard with subtle underglow */}
      <mesh position={[0, DESK_HEIGHT + 0.025, 0.1]}>
        <boxGeometry args={[0.3, 0.01, 0.1]} />
        <meshStandardMaterial color="#aab0b8" roughness={0.6} metalness={0.15} />
      </mesh>
      {/* Keyboard backlight glow */}
      <mesh position={[0, DESK_HEIGHT + 0.02, 0.1]}>
        <planeGeometry args={[0.28, 0.08]} />
        <meshStandardMaterial
          color="#60a0ff"
          emissive="#4080d0"
          emissiveIntensity={0.15}
          transparent
          opacity={0.25}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function OfficeChair({
  position,
  rotation = 0,
  color = "#4a5568",
}: {
  position: [number, number, number];
  rotation?: number;
  color?: string;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Base */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.15, 0.18, 0.04, 5]} />
        <meshStandardMaterial color="#7a8a9a" roughness={0.4} metalness={0.5} />
      </mesh>
      {/* Pole */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.26, 8]} />
        <meshStandardMaterial color="#8898a8" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Seat */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.28, 0.04, 0.28]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {/* Back */}
      <mesh position={[0, 0.56, -0.12]} castShadow>
        <boxGeometry args={[0.26, 0.38, 0.03]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {/* Armrests */}
      <mesh position={[0.15, 0.44, 0]}>
        <boxGeometry args={[0.03, 0.04, 0.2]} />
        <meshStandardMaterial color="#7a8a9a" roughness={0.5} metalness={0.35} />
      </mesh>
      <mesh position={[-0.15, 0.44, 0]}>
        <boxGeometry args={[0.03, 0.04, 0.2]} />
        <meshStandardMaterial color="#7a8a9a" roughness={0.5} metalness={0.35} />
      </mesh>
    </group>
  );
}

function MeetingTable({
  position,
  radius = 1.2,
}: {
  position: [number, number, number];
  radius?: number;
}) {
  return (
    <group position={position}>
      {/* Table surface — slightly tinted */}
      <mesh position={[0, DESK_HEIGHT, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, 0.05, 6]} />
        <meshStandardMaterial color="#8aa8c8" roughness={0.45} metalness={0.08} />
      </mesh>
      {/* Accent rim */}
      <mesh position={[0, DESK_HEIGHT + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.05, radius, 6]} />
        <meshStandardMaterial
          color="#5ba0d0"
          emissive="#4090c0"
          emissiveIntensity={0.2}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Center post */}
      <mesh position={[0, DESK_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.08, 0.12, DESK_HEIGHT, 8]} />
        <meshStandardMaterial color="#7a8a9a" roughness={0.4} metalness={0.45} />
      </mesh>
      {/* Center disc */}
      <mesh position={[0, DESK_HEIGHT + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.3, 32]} />
        <meshStandardMaterial
          color="#b0d0f0"
          emissive="#80b0e0"
          emissiveIntensity={0.15}
          transparent
          opacity={0.6}
        />
      </mesh>
    </group>
  );
}

/** Detailed bookshelf with colored book spines */
function Bookshelf({ position }: { position: [number, number, number] }) {
  const books = useMemo(() => {
    const bookList: { x: number; y: number; width: number; height: number; color: string }[] = [];
    const shelfYs = [0.18, 0.55, 0.92, 1.29];
    const colors = [
      "#4a80c0", "#40a060", "#e08040", "#8060b0", "#d04040", 
      "#30a0a0", "#c06080", "#80a040", "#6060c0", "#c0a040"
    ];
    
    shelfYs.forEach((shelfY) => {
      let x = -0.3;
      while (x < 0.3) {
        const width = 0.04 + Math.random() * 0.05;
        const height = 0.14 + Math.random() * 0.08;
        if (Math.random() > 0.15) { // Some gaps
          bookList.push({
            x,
            y: shelfY + height / 2,
            width,
            height,
            color: colors[Math.floor(Math.random() * colors.length)],
          });
        }
        x += width + 0.008;
      }
    });
    return bookList;
  }, []);

  return (
    <group position={position}>
      {/* Frame back — dark wood */}
      <mesh position={[0, 0.8, -0.13]} castShadow>
        <boxGeometry args={[0.8, 1.6, 0.04]} />
        <meshStandardMaterial color="#5a4a3a" roughness={0.8} metalness={0.05} />
      </mesh>
      {/* Frame sides */}
      <mesh position={[-0.38, 0.8, 0]}>
        <boxGeometry args={[0.04, 1.6, 0.26]} />
        <meshStandardMaterial color="#7a6a5a" roughness={0.75} metalness={0.05} />
      </mesh>
      <mesh position={[0.38, 0.8, 0]}>
        <boxGeometry args={[0.04, 1.6, 0.26]} />
        <meshStandardMaterial color="#7a6a5a" roughness={0.75} metalness={0.05} />
      </mesh>
      {/* Top */}
      <mesh position={[0, 1.6, 0]}>
        <boxGeometry args={[0.8, 0.03, 0.26]} />
        <meshStandardMaterial color="#7a6a5a" roughness={0.75} />
      </mesh>
      {/* Shelves */}
      {[0.02, 0.4, 0.77, 1.14].map((y) => (
        <mesh key={`shelf-${y}`} position={[0, y, 0]}>
          <boxGeometry args={[0.72, 0.03, 0.24]} />
          <meshStandardMaterial color="#9a8a7a" roughness={0.6} />
        </mesh>
      ))}
      {/* Books */}
      {books.map((b, i) => (
        <mesh key={`book-${i}`} position={[b.x, b.y, 0.02]}>
          <boxGeometry args={[b.width, b.height, 0.18]} />
          <meshStandardMaterial color={b.color} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** Upgraded couch with rounded cushions and throw pillows */
function Sofa({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Frame base */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[1.2, 0.18, 0.5]} />
        <meshStandardMaterial color="#5a7a9a" roughness={0.8} />
      </mesh>
      {/* Back */}
      <mesh position={[0, 0.35, -0.22]}>
        <boxGeometry args={[1.2, 0.32, 0.1]} />
        <meshStandardMaterial color="#5a7a9a" roughness={0.8} />
      </mesh>
      {/* Armrests — rounded */}
      {[-0.58, 0.58].map((x, i) => (
        <group key={`arm-${i}`} position={[x, 0.25, 0]}>
          <mesh>
            <boxGeometry args={[0.08, 0.12, 0.5]} />
            <meshStandardMaterial color="#5a7a9a" roughness={0.8} />
          </mesh>
          {/* Rounded top */}
          <mesh position={[0, 0.08, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, 0.08, 8]} />
            <meshStandardMaterial color="#5a7a9a" roughness={0.8} />
          </mesh>
        </group>
      ))}
      {/* Seat cushions — rounded */}
      {[-0.28, 0.28].map((x, i) => (
        <group key={`cushion-${i}`} position={[x, 0.26, 0.02]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.48, 0.08, 0.42]} />
            <meshStandardMaterial color="#7aa0c0" roughness={0.9} />
          </mesh>
          {/* Rounded edges */}
          <mesh position={[0, 0, 0.21]} rotation={[0, Math.PI / 2, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.48, 8]} />
            <meshStandardMaterial color="#7aa0c0" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* Back cushions */}
      {[-0.28, 0.28].map((x, i) => (
        <mesh key={`back-cushion-${i}`} position={[x, 0.38, -0.14]}>
          <boxGeometry args={[0.45, 0.2, 0.08]} />
          <meshStandardMaterial color="#8ab0d0" roughness={0.9} />
        </mesh>
      ))}
      {/* Throw pillows */}
      <group position={[-0.42, 0.35, 0.02]} rotation={[0.1, 0.2, 0.15]}>
        <mesh>
          <boxGeometry args={[0.15, 0.15, 0.06]} />
          <meshStandardMaterial color="#c090d0" roughness={0.95} />
        </mesh>
      </group>
      <group position={[0.42, 0.35, 0.05]} rotation={[-0.1, -0.15, -0.1]}>
        <mesh>
          <boxGeometry args={[0.14, 0.14, 0.05]} />
          <meshStandardMaterial color="#90c0a0" roughness={0.95} />
        </mesh>
      </group>
    </group>
  );
}

function CoffeeTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.6, 0.04, 0.4]} />
        <meshStandardMaterial color="#b0a090" roughness={0.55} metalness={0.05} />
      </mesh>
      {[
        [-0.25, 0.1, -0.15],
        [0.25, 0.1, -0.15],
        [-0.25, 0.1, 0.15],
        [0.25, 0.1, 0.15],
      ].map((pos, i) => (
        <mesh key={`ct-leg-${i}`} position={pos as [number, number, number]}>
          <cylinderGeometry args={[0.015, 0.015, 0.2, 8]} />
          <meshStandardMaterial color="#8898a8" metalness={0.5} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

/** Detailed coffee machine with steam particles */
function CoffeeMachine({ position }: { position: [number, number, number] }) {
  const steamRef = useRef<THREE.Points>(null);
  
  const steamData = useMemo(() => {
    const count = 12;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.05;
      positions[i * 3 + 1] = 0.4 + Math.random() * 0.1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
      velocities[i * 3] = (Math.random() - 0.5) * 0.01;
      velocities[i * 3 + 1] = 0.02 + Math.random() * 0.02;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
    }
    return { positions, velocities, count };
  }, []);

  useFrame((state) => {
    if (!steamRef.current) return;
    const posAttr = steamRef.current.geometry.getAttribute("position");
    const arr = posAttr.array as Float32Array;
    const t = state.clock.elapsedTime;
    
    for (let i = 0; i < steamData.count; i++) {
      arr[i * 3] += steamData.velocities[i * 3] + Math.sin(t + i) * 0.002;
      arr[i * 3 + 1] += steamData.velocities[i * 3 + 1];
      arr[i * 3 + 2] += steamData.velocities[i * 3 + 2];
      
      // Reset when too high
      if (arr[i * 3 + 1] > 0.7) {
        arr[i * 3] = (Math.random() - 0.5) * 0.05;
        arr[i * 3 + 1] = 0.4;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
      }
    }
    posAttr.needsUpdate = true;
    
    // Pulse opacity
    const mat = steamRef.current.material as THREE.PointsMaterial;
    mat.opacity = 0.3 + Math.sin(t * 2) * 0.1;
  });

  return (
    <group position={position}>
      {/* Machine body */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.25, 0.4, 0.2]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.3} metalness={0.6} />
      </mesh>
      {/* Top section */}
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.22, 0.04, 0.18]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.5} />
      </mesh>
      {/* Water tank */}
      <mesh position={[0, 0.3, -0.08]}>
        <boxGeometry args={[0.18, 0.2, 0.04]} />
        <meshStandardMaterial color="#8ab0d0" transparent opacity={0.4} roughness={0.1} />
      </mesh>
      {/* Dispenser nozzle */}
      <mesh position={[0, 0.1, 0.08]}>
        <cylinderGeometry args={[0.02, 0.025, 0.08, 8]} />
        <meshStandardMaterial color="#555555" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Drip tray */}
      <mesh position={[0, 0.02, 0.05]}>
        <boxGeometry args={[0.2, 0.02, 0.12]} />
        <meshStandardMaterial color="#666666" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Cup holder platform */}
      <mesh position={[0, 0.05, 0.05]}>
        <cylinderGeometry args={[0.04, 0.05, 0.02, 8]} />
        <meshStandardMaterial color="#444444" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Control buttons */}
      {[-0.06, 0, 0.06].map((x, i) => (
        <mesh key={`btn-${i}`} position={[x, 0.32, 0.11]}>
          <cylinderGeometry args={[0.015, 0.015, 0.01, 8]} />
          <meshStandardMaterial 
            color={i === 1 ? "#40c040" : "#666666"} 
            emissive={i === 1 ? "#40c040" : "#000000"}
            emissiveIntensity={i === 1 ? 0.5 : 0}
          />
        </mesh>
      ))}
      {/* Steam particles */}
      <points ref={steamRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[steamData.positions.slice(), 3]}
            count={steamData.count}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#ffffff"
          size={0.03}
          transparent
          opacity={0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/** Water cooler with visible water bottle */
function WaterCooler({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Main body */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.25, 0.6, 0.25]} />
        <meshStandardMaterial color="#f0f0f0" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Water bottle (on top) */}
      <group position={[0, 0.72, 0]}>
        {/* Bottle neck */}
        <mesh position={[0, -0.08, 0]}>
          <cylinderGeometry args={[0.04, 0.06, 0.08, 12]} />
          <meshStandardMaterial color="#a0d0f0" transparent opacity={0.3} roughness={0.05} />
        </mesh>
        {/* Bottle body */}
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.32, 12]} />
          <meshStandardMaterial color="#80c0e0" transparent opacity={0.25} roughness={0.05} />
        </mesh>
        {/* Bottle cap */}
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 0.04, 12]} />
          <meshStandardMaterial color="#2060a0" roughness={0.4} />
        </mesh>
        {/* Water level indication */}
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.22, 12]} />
          <meshStandardMaterial 
            color="#4090c0" 
            transparent 
            opacity={0.4} 
            emissive="#2060a0"
            emissiveIntensity={0.1}
          />
        </mesh>
      </group>
      {/* Dispensers */}
      <mesh position={[-0.06, 0.25, 0.13]}>
        <cylinderGeometry args={[0.015, 0.015, 0.03, 8]} />
        <meshStandardMaterial color="#d04040" roughness={0.3} />
      </mesh>
      <mesh position={[0.06, 0.25, 0.13]}>
        <cylinderGeometry args={[0.015, 0.015, 0.03, 8]} />
        <meshStandardMaterial color="#4080d0" roughness={0.3} />
      </mesh>
      {/* Drip tray */}
      <mesh position={[0, 0.02, 0.08]}>
        <boxGeometry args={[0.18, 0.02, 0.08]} />
        <meshStandardMaterial color="#aaaaaa" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Cup holder */}
      <mesh position={[0.15, 0.15, 0.1]}>
        <cylinderGeometry args={[0.05, 0.05, 0.1, 8]} />
        <meshStandardMaterial color="#dddddd" roughness={0.6} />
      </mesh>
    </group>
  );
}

/** Whiteboard with colorful scribbles/diagrams */
function Whiteboard({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Board frame */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[1.6, 1.1, 0.05]} />
        <meshStandardMaterial color="#606060" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* White surface */}
      <mesh position={[0, 1.0, 0.03]}>
        <planeGeometry args={[1.5, 1.0]} />
        <meshStandardMaterial color="#f8f8f8" roughness={0.1} metalness={0.0} />
      </mesh>
      {/* Scribbles - flowchart boxes */}
      <mesh position={[-0.4, 1.15, 0.035]}>
        <planeGeometry args={[0.25, 0.15]} />
        <meshBasicMaterial color="#3060d0" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 1.15, 0.035]}>
        <planeGeometry args={[0.3, 0.15]} />
        <meshBasicMaterial color="#30a060" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0.4, 1.15, 0.035]}>
        <planeGeometry args={[0.25, 0.15]} />
        <meshBasicMaterial color="#d06030" transparent opacity={0.8} />
      </mesh>
      {/* Connecting arrows (simplified as lines) */}
      <mesh position={[-0.2, 1.15, 0.034]}>
        <planeGeometry args={[0.1, 0.02]} />
        <meshBasicMaterial color="#333333" />
      </mesh>
      <mesh position={[0.2, 1.15, 0.034]}>
        <planeGeometry args={[0.1, 0.02]} />
        <meshBasicMaterial color="#333333" />
      </mesh>
      {/* Graph/chart area */}
      <mesh position={[-0.3, 0.8, 0.035]}>
        <planeGeometry args={[0.4, 0.3]} />
        <meshBasicMaterial color="#f0f0f0" transparent opacity={0.9} />
      </mesh>
      {/* Bar chart bars */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`bar-${i}`} position={[-0.45 + i * 0.08, 0.7 + (Math.random() * 0.12), 0.036]}>
          <planeGeometry args={[0.05, 0.08 + Math.random() * 0.12]} />
          <meshBasicMaterial color={["#4080d0", "#40c080", "#d08040", "#8040d0"][i]} />
        </mesh>
      ))}
      {/* Some scribbled text lines */}
      {[0.88, 0.82, 0.76].map((y, i) => (
        <mesh key={`text-${i}`} position={[0.25, y, 0.035]}>
          <planeGeometry args={[0.5 - i * 0.08, 0.02]} />
          <meshBasicMaterial color="#333333" transparent opacity={0.6} />
        </mesh>
      ))}
      {/* Marker tray */}
      <mesh position={[0, 0.42, 0.06]}>
        <boxGeometry args={[0.6, 0.04, 0.06]} />
        <meshStandardMaterial color="#555555" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Markers */}
      {[
        { x: -0.15, color: "#d04040" },
        { x: -0.05, color: "#40a040" },
        { x: 0.05, color: "#4040d0" },
        { x: 0.15, color: "#000000" },
      ].map((m, i) => (
        <mesh key={`marker-${i}`} position={[m.x, 0.44, 0.06]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 0.1, 6]} />
          <meshStandardMaterial color={m.color} />
        </mesh>
      ))}
      {/* Eraser */}
      <mesh position={[0.25, 0.43, 0.06]}>
        <boxGeometry args={[0.08, 0.03, 0.04]} />
        <meshStandardMaterial color="#333333" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Detailed potted plant with multi-level foliage */
function Plant({ 
  position, 
  scale = 1,
  variant = 0 
}: { 
  position: [number, number, number]; 
  scale?: number;
  variant?: number;
}) {
  const leafColor1 = ["#3a8a4a", "#2a7a3a", "#4a9a5a"][variant % 3];
  const leafColor2 = ["#4a9a5a", "#3a8a4a", "#5aaa6a"][variant % 3];
  
  return (
    <group position={position} scale={scale}>
      {/* Pot - terracotta style */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.24, 12]} />
        <meshStandardMaterial color="#a06040" roughness={0.8} />
      </mesh>
      {/* Pot rim */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.14, 0.12, 0.04, 12]} />
        <meshStandardMaterial color="#b07050" roughness={0.75} />
      </mesh>
      {/* Soil */}
      <mesh position={[0, 0.24, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.1, 12]} />
        <meshStandardMaterial color="#4a3a2a" roughness={1.0} />
      </mesh>
      {/* Main stem */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.015, 0.02, 0.3, 6]} />
        <meshStandardMaterial color="#3a5a2a" roughness={0.9} />
      </mesh>
      {/* Lower foliage layer */}
      <mesh position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.18, 8, 6]} />
        <meshStandardMaterial color={leafColor1} roughness={0.85} />
      </mesh>
      {/* Side leaves */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
        <mesh 
          key={`leaf-${i}`} 
          position={[Math.cos(angle) * 0.12, 0.38, Math.sin(angle) * 0.12]}
          rotation={[0.3, angle, 0.2]}
        >
          <sphereGeometry args={[0.1, 6, 4]} />
          <meshStandardMaterial color={i % 2 === 0 ? leafColor1 : leafColor2} roughness={0.85} />
        </mesh>
      ))}
      {/* Upper foliage */}
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.14, 8, 6]} />
        <meshStandardMaterial color={leafColor2} roughness={0.85} />
      </mesh>
      {/* Top accent leaves */}
      <mesh position={[0.05, 0.65, 0.02]} rotation={[0.2, 0.3, 0.1]}>
        <sphereGeometry args={[0.06, 6, 4]} />
        <meshStandardMaterial color="#5aaa6a" roughness={0.85} />
      </mesh>
      <mesh position={[-0.04, 0.62, -0.03]} rotation={[-0.1, -0.2, 0.15]}>
        <sphereGeometry args={[0.05, 6, 4]} />
        <meshStandardMaterial color={leafColor1} roughness={0.85} />
      </mesh>
    </group>
  );
}

/** Pendant ceiling light */
function PendantLight({ position, on = true }: { position: [number, number, number]; on?: boolean }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (!on) return;
    const t = state.clock.elapsedTime;
    if (lightRef.current) {
      lightRef.current.intensity = 0.8 + Math.sin(t * 2 + position[0]) * 0.1;
    }
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.8 + Math.sin(t * 2 + position[0]) * 0.2;
    }
  });

  return (
    <group position={position}>
      {/* Ceiling mount */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.03, 8]} />
        <meshStandardMaterial color="#333333" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Wire/cord */}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.4, 4]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      {/* Lamp shade - cone */}
      <mesh position={[0, -0.45, 0]}>
        <coneGeometry args={[0.15, 0.2, 12, 1, true]} />
        <meshStandardMaterial color="#2a2a2a" side={THREE.DoubleSide} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Bulb glow */}
      <mesh ref={glowRef} position={[0, -0.38, 0]}>
        <sphereGeometry args={[0.06, 12, 8]} />
        <meshStandardMaterial
          color={on ? "#fff8e0" : "#444444"}
          emissive={on ? "#ffd080" : "#000000"}
          emissiveIntensity={on ? 0.8 : 0}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Point light — stronger pools of light on work surfaces */}
      {on && (
        <>
          <pointLight
            ref={lightRef}
            position={[0, -0.4, 0]}
            intensity={1.2}
            distance={4.5}
            decay={2}
            color="#ffd599"
            castShadow={false}
          />
          {/* Spot light cone for visible light pool on floor */}
          <spotLight
            position={[0, -0.3, 0]}
            angle={0.6}
            penumbra={0.8}
            intensity={0.6}
            distance={4}
            decay={2}
            color="#fff0d0"
            castShadow={false}
            target-position={[0, -3, 0]}
          />
        </>
      )}
    </group>
  );
}

/** Area rug/carpet */
function Rug({ 
  position, 
  size, 
  color = "#5a4070" 
}: { 
  position: [number, number, number]; 
  size: [number, number]; 
  color?: string;
}) {
  return (
    <group position={position}>
      {/* Main rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.95} metalness={0.0} />
      </mesh>
      {/* Border pattern */}
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.min(size[0], size[1]) * 0.35, Math.min(size[0], size[1]) * 0.4, 32]} />
        <meshStandardMaterial color="#7c6ff5" transparent opacity={0.3} />
      </mesh>
      {/* Center pattern */}
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[Math.min(size[0], size[1]) * 0.15, 6]} />
        <meshStandardMaterial color="#8a7ae0" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

/** Floating 3D zone sign */
function ZoneSign3D({ 
  position, 
  text, 
  color = "#7c6ff5" 
}: { 
  position: [number, number, number]; 
  text: string; 
  color?: string;
}) {
  return (
    <group position={position}>
      {/* Background panel */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[text.length * 0.12 + 0.3, 0.25]} />
        <meshStandardMaterial 
          color="#1a1a2e" 
          transparent 
          opacity={0.85}
        />
      </mesh>
      {/* Accent line */}
      <mesh position={[0, -0.1, -0.01]}>
        <planeGeometry args={[text.length * 0.12, 0.02]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color}
          emissiveIntensity={0.5}
        />
      </mesh>
      {/* 3D Text */}
      <Text
        position={[0, 0.02, 0]}
        fontSize={0.12}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        font="/fonts/silkscreen.ttf"
      >
        {text}
      </Text>
    </group>
  );
}

function ZoneLabel({
  position,
  label,
  color,
}: {
  position: [number, number, number];
  label: string;
  color: string;
}) {
  return (
    <Html position={position} center style={{ pointerEvents: "none" }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color,
          opacity: 0.85,
          textTransform: "uppercase",
          letterSpacing: "2px",
          whiteSpace: "nowrap",
          userSelect: "none",
          textShadow: "0 1px 3px rgba(255,255,255,0.6)",
        }}
      >
        {label}
      </div>
    </Html>
  );
}

function ZoneFloor({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number];
  color: string;
}) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial color={color} transparent opacity={0.15} roughness={0.85} />
    </mesh>
  );
}

/** Logo backdrop wall in the lounge zone */
function ReceptionWall3D() {
  return (
    <group position={[12, 0, 10]}>
      {/* Main wall panel */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[3, 2, 0.08]} />
        <meshStandardMaterial color="#3b4f6b" roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Top accent strip */}
      <mesh position={[0, 2.02, 0]}>
        <boxGeometry args={[3, 0.04, 0.1]} />
        <meshStandardMaterial color="#7a9bc0" roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Logo text placeholder — emissive panel */}
      <mesh position={[0, 1.2, 0.05]}>
        <planeGeometry args={[1.8, 0.3]} />
        <meshStandardMaterial
          color="#e0e8f0"
          emissive="#90b0d0"
          emissiveIntensity={0.4}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  );
}

/** Curved reception desk in front of the logo wall */
function ReceptionDesk3D() {
  return (
    <group position={[12, 0, 10.8]}>
      {/* Desk body */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.8, 0.5]} />
        <meshStandardMaterial color="#8494a7" roughness={0.7} metalness={0.05} />
      </mesh>
      {/* Desk top surface */}
      <mesh position={[0, 0.82, 0]}>
        <boxGeometry args={[2.5, 0.04, 0.55]} />
        <meshStandardMaterial color="#a5b4c8" roughness={0.5} metalness={0.08} />
      </mesh>
      {/* Front decorative panel */}
      <mesh position={[0, 0.4, 0.26]}>
        <boxGeometry args={[2.3, 0.7, 0.02]} />
        <meshStandardMaterial color="#6a7a8a" roughness={0.6} />
      </mesh>
    </group>
  );
}

export function OfficeLayout3D() {
  const { t } = useTranslation("office");
  return (
    <group>
      {/* === Zone Floor Colors === */}
      <ZoneFloor position={[3.5, 0.015, 2.8]} size={[6.5, 5]} color="#4a90d9" />
      <ZoneFloor position={[12, 0.015, 2.8]} size={[6.5, 5]} color="#9060c0" />
      <ZoneFloor position={[3.5, 0.015, 9]} size={[6.5, 5]} color="#d08030" />
      <ZoneFloor position={[12, 0.015, 9]} size={[6.5, 5]} color="#40a060" />

      {/* === Zone Labels === */}
      <ZoneLabel position={[1.5, 0.05, 0.8]} label={t("zones.desk")} color="#2563eb" />
      <ZoneLabel position={[9.5, 0.05, 0.8]} label={t("zones.meeting")} color="#7c3aed" />
      <ZoneLabel position={[1.5, 0.05, 6.8]} label={t("zones.hotDesk")} color="#c2410c" />
      <ZoneLabel position={[9.5, 0.05, 6.8]} label={t("zones.lounge")} color="#15803d" />

      {/* === Floating Zone Signs === */}
      <ZoneSign3D position={[3.5, 2.2, 0.5]} text="WORKSTATIONS" color="#3b82f6" />
      <ZoneSign3D position={[12, 2.2, 0.5]} text="MEETING ROOM" color="#a855f7" />
      <ZoneSign3D position={[3.5, 2.2, 6.5]} text="HOT DESKS" color="#f97316" />
      <ZoneSign3D position={[12, 2.2, 6.5]} text="LOUNGE" color="#22c55e" />

      {/* === Desk Zone — 2 rows × 3 columns (wider spacing) === */}
      {[
        { pos: [1.5, 0, 1.6] as [number, number, number], rot: 0, chairRot: 0.1 },
        { pos: [3.5, 0, 1.6] as [number, number, number], rot: 0, chairRot: -0.15 },
        { pos: [5.5, 0, 1.6] as [number, number, number], rot: 0, chairRot: 0.2 },
        { pos: [1.5, 0, 3.8] as [number, number, number], rot: Math.PI, chairRot: -0.1 },
        { pos: [3.5, 0, 3.8] as [number, number, number], rot: Math.PI, chairRot: 0.25 },
        { pos: [5.5, 0, 3.8] as [number, number, number], rot: Math.PI, chairRot: -0.2 },
      ].map((ws, i) => (
        <group key={`desk-ws-${i}`}>
          <Workstation position={ws.pos} rotation={ws.rot} />
          <OfficeChair
            position={[ws.pos[0], 0, ws.pos[2] + (ws.rot === 0 ? 0.5 : -0.5)]}
            rotation={ws.rot + ws.chairRot}
            color={i % 2 === 0 ? "#4a5568" : "#3a5068"}
          />
        </group>
      ))}

      {/* === Meeting Zone — hexagonal table + chairs + whiteboard (more spacious) === */}
      <MeetingTable position={[12, 0, 2.8]} radius={1.4} />
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        const r = 2.1;
        // Slight random-ish rotation offsets per chair for natural feel
        const chairJitter = [0.12, -0.08, 0.15, -0.1, 0.05, -0.18][i];
        return (
          <OfficeChair
            key={`meeting-chair-${i}`}
            position={[12 + Math.cos(angle) * r, 0, 2.8 + Math.sin(angle) * r]}
            rotation={angle + Math.PI + chairJitter}
            color="#3a6080"
          />
        );
      })}
      {/* Whiteboard in meeting zone */}
      <Whiteboard position={[14.8, 0, 0.8]} rotation={Math.PI} />

      {/* === Hot Desk Zone — 2 rows × 3 columns (wider spacing) === */}
      {[
        { pos: [1.5, 0, 7.6] as [number, number, number], rot: 0, chairRot: -0.12 },
        { pos: [3.5, 0, 7.6] as [number, number, number], rot: 0, chairRot: 0.18 },
        { pos: [5.5, 0, 7.6] as [number, number, number], rot: 0, chairRot: -0.08 },
        { pos: [1.5, 0, 10.0] as [number, number, number], rot: Math.PI, chairRot: 0.15 },
        { pos: [3.5, 0, 10.0] as [number, number, number], rot: Math.PI, chairRot: -0.22 },
        { pos: [5.5, 0, 10.0] as [number, number, number], rot: Math.PI, chairRot: 0.1 },
      ].map((ws, i) => (
        <group key={`hotdesk-ws-${i}`}>
          <Workstation position={ws.pos} rotation={ws.rot} />
          <OfficeChair
            position={[ws.pos[0], 0, ws.pos[2] + (ws.rot === 0 ? 0.5 : -0.5)]}
            rotation={ws.rot + ws.chairRot}
            color="#6a5a4a"
          />
        </group>
      ))}

      {/* === Lounge Zone — sofas, coffee area, rug (more spacious) === */}
      {/* Area rug under lounge seating */}
      <Rug position={[11.8, 0.008, 8.5]} size={[4.5, 3.2]} color="#3a2a48" />

      <Sofa position={[10.2, 0, 7.5]} rotation={0} />
      <Sofa position={[13.2, 0, 7.5]} rotation={0} />
      <Sofa position={[10.2, 0, 9.5]} rotation={Math.PI} />
      <CoffeeTable position={[11.8, 0, 8.5]} />
      <Sofa position={[14.8, 0, 8.5]} rotation={Math.PI / 2} />

      {/* === Coffee Machine & Water Cooler === */}
      <CoffeeMachine position={[9.5, 0, 7.2]} />
      <WaterCooler position={[9.8, 0, 9.5]} />

      {/* === Logo backdrop wall === */}
      <ReceptionWall3D />
      <Bookshelf position={[10, 0, 10]} />
      <Bookshelf position={[14, 0, 10]} />

      {/* === Reception desk === */}
      <ReceptionDesk3D />

      {/* === Ceiling Lights === */}
      {/* Desk zone lights */}
      <PendantLight position={[2.5, 2.8, 2.5]} />
      <PendantLight position={[4.5, 2.8, 2.5]} />
      <PendantLight position={[3.5, 2.8, 4]} />
      {/* Meeting zone lights */}
      <PendantLight position={[12, 2.8, 2.8]} />
      {/* Hot desk lights */}
      <PendantLight position={[2.5, 2.8, 8.5]} />
      <PendantLight position={[4.5, 2.8, 8.5]} />
      {/* Lounge lights - warmer feel */}
      <PendantLight position={[11, 2.8, 8]} />
      <PendantLight position={[13, 2.8, 8.5]} />

      {/* === Plants (varied sizes and positions) === */}
      <Plant position={[0.5, 0, 0.5]} scale={1.2} variant={0} />
      <Plant position={[0.5, 0, 5.2]} scale={0.9} variant={1} />
      <Plant position={[6.5, 0, 0.5]} scale={1.0} variant={2} />
      <Plant position={[6.5, 0, 5.2]} scale={1.1} variant={0} />
      <Plant position={[8.5, 0, 0.5]} scale={0.85} variant={1} />
      <Plant position={[15, 0, 0.5]} scale={1.3} variant={2} />
      <Plant position={[0.5, 0, 6.5]} scale={1.0} variant={0} />
      <Plant position={[0.5, 0, 11.2]} scale={1.15} variant={1} />
      <Plant position={[6.5, 0, 6.5]} scale={0.9} variant={2} />
      <Plant position={[6.5, 0, 11.2]} scale={1.0} variant={0} />
      <Plant position={[10, 0, 10.5]} scale={0.8} variant={1} />
      <Plant position={[14, 0, 10.5]} scale={0.85} variant={2} />
      <Plant position={[15.2, 0, 7]} scale={1.1} variant={0} />
      <Plant position={[15.2, 0, 10]} scale={0.95} variant={1} />
    </group>
  );
}
