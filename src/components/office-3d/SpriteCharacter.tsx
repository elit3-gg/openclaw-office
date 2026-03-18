import { useFrame, useLoader } from "@react-three/fiber";
import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import {
  createIdleBehaviorState,
  tickIdleBehavior,
  getIdleFacingDirection,
} from "@/lib/idle-behaviors";
import { getSpritePathForAgent } from "@/lib/agent-sprites";

const SHEET_COLS = 4;
const SHEET_ROWS = 4;

// Direction rows in spritesheet
const DIR_DOWN = 0;
const DIR_LEFT = 1;
const DIR_RIGHT = 2;
const DIR_UP = 3;

interface SpriteCharacterProps {
  agentId: string;
  isWalking: boolean;
  /** Movement direction in radians (atan2-based), or null for idle */
  moveDirection: { dx: number; dz: number } | null;
  /** Scale multiplier */
  scale?: number;
  /** Opacity */
  opacity?: number;
  /** Tint color (hex string like "#ff0000") */
  tint?: string;
  /** Whether agent is actively working (suppresses idle behaviors) */
  isActive?: boolean;
}

/**
 * Billboard sprite character using the same RPG sprite sheets as the 2D PixiJS view.
 * Each agent gets a unique character skin based on their ID.
 * Supports 4-direction walk animation.
 */
export function SpriteCharacter({
  agentId,
  isWalking,
  moveDirection,
  scale = 1,
  opacity = 1,
  tint,
  isActive = false,
}: SpriteCharacterProps) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const animFrame = useRef(0);
  const animTimer = useRef(0);
  const currentDir = useRef(DIR_DOWN);
  const idleBehavior = useRef(createIdleBehaviorState());

  const texturePath = useMemo(() => getSpritePathForAgent(agentId), [agentId]);

  // Load the sprite sheet texture
  const texture = useLoader(THREE.TextureLoader, texturePath);

  // Create a cloned texture for per-agent UV manipulation
  const spriteTexture = useMemo(() => {
    const tex = texture.clone();
    tex.needsUpdate = true;
    // Pixel art: use nearest filtering
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    // Set initial UV to frame 1 of DIR_DOWN (idle facing down)
    tex.repeat.set(1 / SHEET_COLS, 1 / SHEET_ROWS);
    tex.offset.set(1 / SHEET_COLS, 1 - 1 / SHEET_ROWS); // col 1, row 0
    return tex;
  }, [texture]);

  // Material with optional tint
  const material = useMemo(() => {
    const mat = new THREE.SpriteMaterial({
      map: spriteTexture,
      transparent: true,
      opacity,
      alphaTest: 0.1,
    });
    if (tint) {
      mat.color.set(tint);
    }
    return mat;
  }, [spriteTexture, opacity, tint]);

  // Update opacity/tint dynamically
  useEffect(() => {
    material.opacity = opacity;
    if (tint) {
      material.color.set(tint);
    } else {
      material.color.set("#ffffff");
    }
  }, [material, opacity, tint]);

  // Animation loop
  useFrame((_, delta) => {
    if (!spriteTexture) return;

    // Tick idle behavior system
    tickIdleBehavior(idleBehavior.current, delta, isActive);

    // Determine direction from movement
    if (moveDirection && isWalking) {
      const { dx, dz } = moveDirection;
      if (Math.abs(dx) > Math.abs(dz)) {
        currentDir.current = dx > 0 ? DIR_RIGHT : DIR_LEFT;
      } else {
        currentDir.current = dz > 0 ? DIR_DOWN : DIR_UP;
      }
    }

    if (isWalking) {
      // Animate walk cycle
      animTimer.current += delta * 6; // ~6 FPS animation
      if (animTimer.current >= 1) {
        animTimer.current = 0;
        animFrame.current = (animFrame.current + 1) % SHEET_COLS;
      }
    } else {
      // Idle: use facing direction from idle behavior if available
      const idleFacing = getIdleFacingDirection(idleBehavior.current);
      if (idleFacing !== null) {
        currentDir.current = idleFacing;
      }

      // Typing behavior: rapid frame cycling for "working" animation
      if (idleBehavior.current.current === "typing") {
        animTimer.current += delta * 4;
        if (animTimer.current >= 1) {
          animTimer.current = 0;
          animFrame.current = animFrame.current === 0 ? 1 : 0;
        }
      } else {
        animFrame.current = 0;
        animTimer.current = 0;
      }
    }

    // Apply idle micro-offsets to sprite position
    if (!isWalking && spriteRef.current) {
      const charHeight = 0.6 * scale;
      spriteRef.current.position.y = charHeight / 2 + idleBehavior.current.offsetY * 0.01;
      spriteRef.current.position.x = idleBehavior.current.offsetX * 0.005;
    }

    // Update UV offset for current frame
    const col = animFrame.current;
    const row = currentDir.current;
    spriteTexture.offset.set(
      col / SHEET_COLS,
      1 - (row + 1) / SHEET_ROWS, // flip Y for texture coords
    );
  });

  // Character height in 3D world units — big prominent characters
  const charHeight = 1.4 * scale;

  return (
    <sprite
      ref={spriteRef}
      material={material}
      position={[0, charHeight / 2, 0]}
      scale={[charHeight, charHeight, 1]}
    />
  );
}
