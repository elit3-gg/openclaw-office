import { Graphics } from "pixi.js";
import type { CollaborationLink, VisualAgent } from "@/gateway/types";

// ═══════════════════════════════════════════════════════════
// Gather.town-style connection lines between communicating agents
// Animated flowing particles, warm glow, data stream feel
// ═══════════════════════════════════════════════════════════

const DASH_LENGTH = 8;
const GAP_LENGTH = 5;

// Connection color palette
const COLOR_DEFAULT = 0x7c6ff5;     // Purple (agent-to-agent)
// const COLOR_SPAWN = 0x06b6d4;   // Cyan (spawn links) — reserved for future
const COLOR_ACTIVE = 0xa78bfa;      // Bright purple (high activity)

interface FlowParticle {
  t: number;      // Progress along the line (0-1)
  speed: number;  // How fast this particle moves
  size: number;   // Particle size
  alpha: number;  // Base alpha
}

const MAX_PARTICLES_PER_LINK = 5;

export class ConnectionLines {
  public readonly graphics: Graphics;
  private animPhase: number = 0;
  private particlePool: Map<string, FlowParticle[]> = new Map();

  constructor() {
    this.graphics = new Graphics();
  }

  private getLinkKey(link: CollaborationLink): string {
    return `${link.sourceId}→${link.targetId}`;
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
    // Adjust count
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

  public update(
    links: CollaborationLink[],
    agents: Map<string, VisualAgent>,
    dt: number,
  ): void {
    this.graphics.clear();
    this.animPhase += 0.025 * dt;

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

      const baseAlpha = 0.12 + link.strength * 0.4;
      const isActive = link.strength > 0.5;
      const lineColor = isActive ? COLOR_ACTIVE : COLOR_DEFAULT;

      // Outer glow (wider, more transparent)
      this.graphics.moveTo(x1, y1);
      this.graphics.lineTo(x2, y2);
      this.graphics.stroke({ color: lineColor, width: 4, alpha: baseAlpha * 0.2 });

      // Animated dashed line
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
          this.graphics.stroke({ color: lineColor, width: 1.5, alpha: baseAlpha });
        }
        pos += totalStep;
      }

      // Flowing particles along the line
      const key = this.getLinkKey(link);
      const particleCount = Math.min(
        MAX_PARTICLES_PER_LINK,
        Math.ceil(link.strength * MAX_PARTICLES_PER_LINK),
      );
      const particles = this.ensureParticles(key, particleCount);

      for (let i = 0; i < particleCount; i++) {
        const p = particles[i];
        p.t += p.speed * dt * 0.008;
        if (p.t > 1) p.t -= 1;

        const px = x1 + nx * len * p.t;
        const py = y1 + ny * len * p.t;

        // Particle glow
        this.graphics.circle(px, py, p.size + 1);
        this.graphics.fill({ color: lineColor, alpha: p.alpha * 0.3 });
        // Particle core
        this.graphics.circle(px, py, p.size);
        this.graphics.fill({ color: 0xffffff, alpha: p.alpha * 0.6 });
      }

      // Endpoint dots (connection nodes)
      // Source
      this.graphics.circle(x1, y1, 3);
      this.graphics.fill({ color: lineColor, alpha: baseAlpha * 0.8 });
      this.graphics.circle(x1, y1, 1.5);
      this.graphics.fill({ color: 0xffffff, alpha: baseAlpha * 0.5 });

      // Target
      this.graphics.circle(x2, y2, 3);
      this.graphics.fill({ color: lineColor, alpha: baseAlpha * 0.8 });
      this.graphics.circle(x2, y2, 1.5);
      this.graphics.fill({ color: 0xffffff, alpha: baseAlpha * 0.5 });
    }

    // Cleanup stale particle pools
    const activeKeys = new Set(links.map(this.getLinkKey));
    for (const key of this.particlePool.keys()) {
      if (!activeKeys.has(key)) {
        this.particlePool.delete(key);
      }
    }
  }

  public destroy(): void {
    this.graphics.destroy();
    this.particlePool.clear();
  }
}
