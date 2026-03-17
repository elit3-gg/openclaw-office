import { Graphics } from "pixi.js";
import type { CollaborationLink, VisualAgent } from "@/gateway/types";

const LINE_COLOR = 0x60a5fa;
const DASH_LENGTH = 6;
const GAP_LENGTH = 4;

export class ConnectionLines {
  public readonly graphics: Graphics;
  private animPhase: number = 0;

  constructor() {
    this.graphics = new Graphics();
  }

  public update(
    links: CollaborationLink[],
    agents: Map<string, VisualAgent>,
    dt: number,
  ): void {
    this.graphics.clear();
    this.animPhase += 0.03 * dt;

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

      const alpha = 0.15 + link.strength * 0.35;

      // Glow line (wider, more transparent)
      this.graphics.moveTo(x1, y1);
      this.graphics.lineTo(x2, y2);
      this.graphics.stroke({ color: LINE_COLOR, width: 3, alpha: alpha * 0.3 });

      // Animated dashed line
      const totalStep = DASH_LENGTH + GAP_LENGTH;
      const offset = (this.animPhase * 20) % totalStep;

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
          this.graphics.stroke({ color: LINE_COLOR, width: 1.5, alpha });
        }
        pos += totalStep;
      }

      // Small dots at endpoints
      this.graphics.circle(x1, y1, 2);
      this.graphics.fill({ color: LINE_COLOR, alpha });
      this.graphics.circle(x2, y2, 2);
      this.graphics.fill({ color: LINE_COLOR, alpha });
    }
  }

  public destroy(): void {
    this.graphics.destroy();
  }
}
