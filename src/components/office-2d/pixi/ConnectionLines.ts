import { Graphics } from "pixi.js";
import type { CollaborationLink, VisualAgent } from "@/gateway/types";

// ═══════════════════════════════════════════════════════════
// Energy-beam style connection lines between communicating agents
// Lightning/electricity effect, pulsing halos, flowing particles
// ═══════════════════════════════════════════════════════════

const DASH_LENGTH = 8;
const GAP_LENGTH = 5;

// Connection color palette
const COLOR_DEFAULT = 0x7c6ff5;     // Purple (agent-to-agent)
const COLOR_ACTIVE = 0xa78bfa;      // Bright purple (high activity)
const COLOR_FLASH = 0xffffff;       // Flash white for new connections

interface FlowParticle {
  t: number;      // Progress along the line (0-1)
  speed: number;  // How fast this particle moves
  size: number;   // Particle size
  alpha: number;  // Base alpha
}

const MAX_PARTICLES_PER_LINK = 5;

// Lightning jitter seed per segment
interface JitterSeed {
  offsets: number[];  // Pre-computed perpendicular offsets
  phase: number;
}

// Flash tracking for new connections
interface ConnectionFlash {
  age: number;       // How many frames old
  maxAge: number;    // When to remove
}

export class ConnectionLines {
  public readonly graphics: Graphics;
  private animPhase: number = 0;
  private particlePool: Map<string, FlowParticle[]> = new Map();
  private jitterPool: Map<string, JitterSeed> = new Map();
  private flashPool: Map<string, ConnectionFlash> = new Map();
  private previousKeys: Set<string> = new Set();

  constructor() {
    this.graphics = new Graphics();
  }

  private getLinkKey(link: CollaborationLink): string {
    return `${link.sourceId}\u2192${link.targetId}`;
  }

  private ensureParticles(key: string, count: number): FlowParticle[] {
    let particles = this.particlePool.get(key);
    if (!particles) {
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          t: Math.random(),
          speed: 0.3 + Math.random() * 0.5,
          size: 1.5 + Math.random() * 1.5,
          alpha: 0.4 + Math.random() * 0.4,
        });
      }
      this.particlePool.set(key, particles);
    }
    while (particles.length < count) {
      particles.push({
        t: Math.random(),
        speed: 0.3 + Math.random() * 0.5,
        size: 1.5 + Math.random() * 1.5,
        alpha: 0.4 + Math.random() * 0.4,
      });
    }
    return particles;
  }

  private ensureJitter(key: string, segmentCount: number): JitterSeed {
    let jitter = this.jitterPool.get(key);
    if (!jitter || jitter.offsets.length !== segmentCount) {
      const offsets: number[] = [];
      for (let i = 0; i < segmentCount; i++) {
        offsets.push((Math.random() - 0.5) * 2);
      }
      jitter = { offsets, phase: Math.random() * Math.PI * 2 };
      this.jitterPool.set(key, jitter);
    }
    return jitter;
  }

  public update(
    links: CollaborationLink[],
    agents: Map<string, VisualAgent>,
    dt: number,
  ): void {
    if (!this.graphics || this.graphics.destroyed) return;
    this.graphics.clear();
    this.animPhase += 0.025 * dt;

    const currentKeys = new Set<string>();

    for (const link of links) {
      const source = agents.get(link.sourceId);
      const target = agents.get(link.targetId);
      if (!source || !target) continue;

      const x1 = source.position.x;
      const y1 = source.position.y;
      const x2 = target.position.x;
      const y2 = target.position.y;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) continue;

      const nx = dx / len;
      const ny = dy / len;
      // Perpendicular
      const px = -ny;
      const py = nx;

      const key = this.getLinkKey(link);
      currentKeys.add(key);

      const baseAlpha = 0.12 + link.strength * 0.4;
      const isActive = link.strength > 0.5;
      const lineColor = isActive ? COLOR_ACTIVE : COLOR_DEFAULT;

      // Check for "connection established" flash
      if (!this.previousKeys.has(key)) {
        this.flashPool.set(key, { age: 0, maxAge: 30 });
      }

      // Draw flash effect if active
      const flash = this.flashPool.get(key);
      if (flash && flash.age < flash.maxAge) {
        flash.age += dt;
        const flashAlpha = Math.max(0, 1 - flash.age / flash.maxAge) * 0.6;
        const flashWidth = 6 * (1 - flash.age / flash.maxAge);
        this.graphics.moveTo(x1, y1);
        this.graphics.lineTo(x2, y2);
        this.graphics.stroke({ color: COLOR_FLASH, width: flashWidth + 4, alpha: flashAlpha * 0.3 });
        this.graphics.moveTo(x1, y1);
        this.graphics.lineTo(x2, y2);
        this.graphics.stroke({ color: COLOR_FLASH, width: flashWidth, alpha: flashAlpha });
      }

      // Outer glow (wider, more transparent)
      this.graphics.moveTo(x1, y1);
      this.graphics.lineTo(x2, y2);
      this.graphics.stroke({ color: lineColor, width: 4, alpha: baseAlpha * 0.2 });

      // Lightning / electricity effect -- jagged line with micro-offsets
      const segLen = 8;
      const segCount = Math.max(2, Math.ceil(len / segLen));
      const jitter = this.ensureJitter(key, segCount);
      jitter.phase += 0.1 * dt;

      // Regenerate jitter periodically for electricity feel
      if (Math.random() < 0.15 * dt) {
        for (let i = 1; i < jitter.offsets.length - 1; i++) {
          jitter.offsets[i] = (Math.random() - 0.5) * 2;
        }
      }

      const jitterStrength = 1.5 + link.strength * 2;
      // Draw jagged electricity line
      const prevPoint = { x: x1, y: y1 };
      for (let i = 1; i <= segCount; i++) {
        const t = i / segCount;
        let lx = x1 + nx * len * t;
        let ly = y1 + ny * len * t;

        // Add perpendicular jitter (not at endpoints)
        if (i < segCount) {
          const jitterVal = jitter.offsets[i] * jitterStrength *
            Math.sin(jitter.phase + i * 0.5);
          lx += px * jitterVal;
          ly += py * jitterVal;
        }

        this.graphics.moveTo(prevPoint.x, prevPoint.y);
        this.graphics.lineTo(lx, ly);
        this.graphics.stroke({ color: lineColor, width: 1.5, alpha: baseAlpha });

        prevPoint.x = lx;
        prevPoint.y = ly;
      }

      // Animated dashed overlay (subtle, behind the jitter)
      const totalStep = DASH_LENGTH + GAP_LENGTH;
      const offset = (this.animPhase * 30) % totalStep;
      let pos = -offset;
      while (pos < len) {
        const start = Math.max(0, pos);
        const end = Math.min(len, pos + DASH_LENGTH);
        if (end > start) {
          const sx = x1 + nx * start;
          const sy = y1 + ny * start;
          const ex = x1 + nx * end;
          const ey = y1 + ny * end;

          this.graphics.moveTo(sx, sy);
          this.graphics.lineTo(ex, ey);
          this.graphics.stroke({ color: lineColor, width: 0.8, alpha: baseAlpha * 0.5 });
        }
        pos += totalStep;
      }

      // Flowing particles -- speed scales with link strength
      const particleCount = Math.min(
        MAX_PARTICLES_PER_LINK,
        Math.ceil(link.strength * MAX_PARTICLES_PER_LINK),
      );
      const particles = this.ensureParticles(key, particleCount);
      const speedMultiplier = 0.5 + link.strength * 1.5;

      for (let i = 0; i < particleCount; i++) {
        const p = particles[i];
        p.t += p.speed * dt * 0.008 * speedMultiplier;
        if (p.t > 1) p.t -= 1;

        const ppx = x1 + nx * len * p.t;
        const ppy = y1 + ny * len * p.t;

        // Particle glow
        this.graphics.circle(ppx, ppy, p.size + 1.5);
        this.graphics.fill({ color: lineColor, alpha: p.alpha * 0.25 });
        // Particle core
        this.graphics.circle(ppx, ppy, p.size);
        this.graphics.fill({ color: 0xffffff, alpha: p.alpha * 0.7 });
      }

      // Endpoint nodes with pulsing halos
      const haloPulse = 0.6 + 0.4 * Math.sin(this.animPhase * 3);

      // Source
      this.graphics.circle(x1, y1, 5);
      this.graphics.fill({ color: lineColor, alpha: baseAlpha * 0.2 * haloPulse });
      this.graphics.circle(x1, y1, 3);
      this.graphics.fill({ color: lineColor, alpha: baseAlpha * 0.8 });
      this.graphics.circle(x1, y1, 1.5);
      this.graphics.fill({ color: 0xffffff, alpha: baseAlpha * 0.6 });

      // Target
      this.graphics.circle(x2, y2, 5);
      this.graphics.fill({ color: lineColor, alpha: baseAlpha * 0.2 * haloPulse });
      this.graphics.circle(x2, y2, 3);
      this.graphics.fill({ color: lineColor, alpha: baseAlpha * 0.8 });
      this.graphics.circle(x2, y2, 1.5);
      this.graphics.fill({ color: 0xffffff, alpha: baseAlpha * 0.6 });
    }

    // Track previous keys for flash detection
    this.previousKeys = currentKeys;

    // Cleanup stale pools
    for (const key of this.particlePool.keys()) {
      if (!currentKeys.has(key)) {
        this.particlePool.delete(key);
      }
    }
    for (const key of this.jitterPool.keys()) {
      if (!currentKeys.has(key)) {
        this.jitterPool.delete(key);
      }
    }
    for (const key of this.flashPool.keys()) {
      const flash = this.flashPool.get(key)!;
      if (!currentKeys.has(key) || flash.age >= flash.maxAge) {
        this.flashPool.delete(key);
      }
    }
  }

  public destroy(): void {
    this.graphics.destroy();
    this.particlePool.clear();
    this.jitterPool.clear();
    this.flashPool.clear();
  }
}
