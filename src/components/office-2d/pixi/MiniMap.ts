import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { OFFICE, ZONES, SVG_WIDTH, SVG_HEIGHT } from "@/lib/constants";
import type { VisualAgent } from "@/gateway/types";

const MAP_WIDTH = 170;
const MAP_HEIGHT = 96;
const MAP_MARGIN = 12;
const MAP_PADDING = 5;

// Scale from world coords to minimap
const SCALE_X = (MAP_WIDTH - MAP_PADDING * 2) / SVG_WIDTH;
const SCALE_Y = (MAP_HEIGHT - MAP_PADDING * 2) / SVG_HEIGHT;

// Status colors (hex)
const STATUS_MAP: Record<string, number> = {
  idle: 0x22c55e,
  thinking: 0x3b82f6,
  tool_calling: 0xf97316,
  speaking: 0xa855f7,
  spawning: 0x06b6d4,
  error: 0xef4444,
  offline: 0x6b7280,
};

const ZONE_MINIMAP_COLORS: Record<string, number> = {
  desk: 0x2a2a42,
  meeting: 0x2e2844,
  hotDesk: 0x2a2d40,
  lounge: 0x332844,
};

const NEON_COLOR = 0x7c6ff5;
const BRACKET_SIZE = 8;

export class MiniMap {
  public readonly container: Container;

  private bg: Graphics;
  private neonBorder: Graphics;
  private scanLines: Graphics;
  private zoneGraphics: Graphics;
  private agentGraphics: Graphics;
  private viewportRect: Graphics;
  private zoneCountTexts: Map<string, Text> = new Map();

  private _onJump: ((worldX: number, worldY: number) => void) | null = null;
  private animPhase: number = 0;

  constructor() {
    this.container = new Container();
    this.container.sortableChildren = true;

    // Background -- dark frosted panel
    this.bg = new Graphics();
    this.bg.roundRect(0, 0, MAP_WIDTH, MAP_HEIGHT, 4);
    this.bg.fill({ color: 0x0d0d1a, alpha: 0.92 });
    this.bg.zIndex = 0;
    this.container.addChild(this.bg);

    // Neon border with corner brackets
    this.neonBorder = new Graphics();
    this.neonBorder.zIndex = 5;
    this.drawNeonBorder();
    this.container.addChild(this.neonBorder);

    // Scan-line effect overlay
    this.scanLines = new Graphics();
    this.scanLines.zIndex = 6;
    this.drawScanLines();
    this.container.addChild(this.scanLines);

    // Zone fills
    this.zoneGraphics = new Graphics();
    this.zoneGraphics.zIndex = 1;
    this.drawZones();
    this.container.addChild(this.zoneGraphics);

    // Agents
    this.agentGraphics = new Graphics();
    this.agentGraphics.zIndex = 2;
    this.container.addChild(this.agentGraphics);

    // Viewport rectangle
    this.viewportRect = new Graphics();
    this.viewportRect.zIndex = 3;
    this.container.addChild(this.viewportRect);

    // Title
    const title = new Text({
      text: "MAP",
      style: new TextStyle({
        fontSize: 7,
        fontFamily: "'JetBrains Mono', monospace",
        fill: 0x9a8aff,
        fontWeight: "bold",
        letterSpacing: 1.5,
      }),
    });
    title.x = MAP_WIDTH / 2;
    title.y = 2;
    title.anchor.set(0.5, 0);
    title.zIndex = 7;
    this.container.addChild(title);

    // "N" compass indicator (top-right inside the map)
    const compass = new Text({
      text: "N",
      style: new TextStyle({
        fontSize: 6,
        fontFamily: "'JetBrains Mono', monospace",
        fill: 0x7c6ff5,
        fontWeight: "bold",
      }),
    });
    compass.x = MAP_WIDTH - 10;
    compass.y = 3;
    compass.anchor.set(0.5, 0);
    compass.zIndex = 7;
    this.container.addChild(compass);

    // Compass arrow (tiny triangle above N)
    const compassArrow = new Graphics();
    compassArrow.moveTo(MAP_WIDTH - 10, 2);
    compassArrow.lineTo(MAP_WIDTH - 12, 6);
    compassArrow.lineTo(MAP_WIDTH - 8, 6);
    compassArrow.closePath();
    compassArrow.fill({ color: 0x7c6ff5, alpha: 0.5 });
    compassArrow.zIndex = 7;
    this.container.addChild(compassArrow);

    // Zone agent count texts
    const countStyle = new TextStyle({
      fontSize: 6,
      fontFamily: "'JetBrains Mono', monospace",
      fill: 0x9a9aba,
      fontWeight: "bold",
    });

    for (const [key, zone] of Object.entries(ZONES)) {
      const t = new Text({ text: "0", style: countStyle });
      const mx = MAP_PADDING + (zone.x + zone.width / 2) * SCALE_X;
      const my = MAP_PADDING + (zone.y + zone.height / 2) * SCALE_Y;
      t.x = mx;
      t.y = my;
      t.anchor.set(0.5, 0.5);
      t.zIndex = 4;
      t.alpha = 0.6;
      this.container.addChild(t);
      this.zoneCountTexts.set(key, t);
    }

    // Interactive for click-to-jump
    this.container.eventMode = "static";
    this.container.cursor = "pointer";
    this.container.on("pointerdown", (e) => {
      const local = this.container.toLocal(e.global);
      const worldX = (local.x - MAP_PADDING) / SCALE_X;
      const worldY = (local.y - MAP_PADDING) / SCALE_Y;
      this._onJump?.(worldX, worldY);
    });
  }

  private drawNeonBorder(): void {
    const g = this.neonBorder;
    const w = MAP_WIDTH;
    const h = MAP_HEIGHT;

    // Thin neon border (full perimeter)
    g.roundRect(0, 0, w, h, 4);
    g.stroke({ color: NEON_COLOR, width: 1, alpha: 0.5 });

    // Outer soft glow
    g.roundRect(-1, -1, w + 2, h + 2, 5);
    g.stroke({ color: NEON_COLOR, width: 2, alpha: 0.1 });

    // Corner brackets "[ ]" style
    const b = BRACKET_SIZE;
    const a = 0.8;

    // Top-left bracket
    g.moveTo(0, b); g.lineTo(0, 0); g.lineTo(b, 0);
    g.stroke({ color: NEON_COLOR, width: 1.5, alpha: a });

    // Top-right bracket
    g.moveTo(w - b, 0); g.lineTo(w, 0); g.lineTo(w, b);
    g.stroke({ color: NEON_COLOR, width: 1.5, alpha: a });

    // Bottom-left bracket
    g.moveTo(0, h - b); g.lineTo(0, h); g.lineTo(b, h);
    g.stroke({ color: NEON_COLOR, width: 1.5, alpha: a });

    // Bottom-right bracket
    g.moveTo(w - b, h); g.lineTo(w, h); g.lineTo(w, h - b);
    g.stroke({ color: NEON_COLOR, width: 1.5, alpha: a });
  }

  private drawScanLines(): void {
    const g = this.scanLines;
    // Horizontal scan lines -- very faint, every 3 pixels
    for (let y = 0; y < MAP_HEIGHT; y += 3) {
      g.rect(0, y, MAP_WIDTH, 1);
      g.fill({ color: 0x000000, alpha: 0.06 });
    }
  }

  private drawZones(): void {
    // Office shell
    this.zoneGraphics.roundRect(
      MAP_PADDING + OFFICE.x * SCALE_X,
      MAP_PADDING + OFFICE.y * SCALE_Y,
      OFFICE.width * SCALE_X,
      OFFICE.height * SCALE_Y,
      3,
    );
    this.zoneGraphics.fill({ color: 0x252540, alpha: 0.9 });

    // Zone fills
    for (const [key, zone] of Object.entries(ZONES)) {
      const color = ZONE_MINIMAP_COLORS[key] ?? 0x2a2a42;
      this.zoneGraphics.rect(
        MAP_PADDING + zone.x * SCALE_X,
        MAP_PADDING + zone.y * SCALE_Y,
        zone.width * SCALE_X,
        zone.height * SCALE_Y,
      );
      this.zoneGraphics.fill(color);
    }
  }

  public updateAgents(agents: Map<string, VisualAgent>): void {
    this.agentGraphics.clear();

    // Count agents per zone
    const zoneCounts: Record<string, number> = {};
    for (const key of Object.keys(ZONES)) zoneCounts[key] = 0;

    for (const [, agent] of agents) {
      const hex = STATUS_MAP[agent.status] ?? 0x6b7280;
      const mx = MAP_PADDING + agent.position.x * SCALE_X;
      const my = MAP_PADDING + agent.position.y * SCALE_Y;

      // Glow
      this.agentGraphics.circle(mx, my, 3.5);
      this.agentGraphics.fill({ color: hex, alpha: 0.3 });
      // Dot
      this.agentGraphics.circle(mx, my, 2);
      this.agentGraphics.fill(hex);

      // Count which zone this agent is in
      for (const [key, zone] of Object.entries(ZONES)) {
        if (
          agent.position.x >= zone.x &&
          agent.position.x <= zone.x + zone.width &&
          agent.position.y >= zone.y &&
          agent.position.y <= zone.y + zone.height
        ) {
          zoneCounts[key] = (zoneCounts[key] ?? 0) + 1;
          break;
        }
      }
    }

    // Update zone count texts
    for (const [key, text] of this.zoneCountTexts) {
      const count = zoneCounts[key] ?? 0;
      text.text = count > 0 ? String(count) : "";
    }
  }

  public updateViewport(x: number, y: number, width: number, height: number): void {
    this.viewportRect.clear();
    const rx = MAP_PADDING + x * SCALE_X;
    const ry = MAP_PADDING + y * SCALE_Y;
    const rw = width * SCALE_X;
    const rh = height * SCALE_Y;

    this.viewportRect.rect(rx, ry, rw, rh);
    this.viewportRect.stroke({ color: 0x7c6ff5, width: 1.2, alpha: 0.7 });
    this.viewportRect.fill({ color: 0x7c6ff5, alpha: 0.04 });
  }

  /** Call from the ticker to animate the minimap */
  public tick(dt: number): void {
    this.animPhase += 0.015 * dt;

    // Pulse the viewport rectangle alpha gently
    const vpPulse = 0.85 + 0.15 * Math.sin(this.animPhase * 2);
    this.viewportRect.alpha = vpPulse;

    // Pulse the neon border subtly
    const borderPulse = 0.8 + 0.2 * Math.sin(this.animPhase);
    this.neonBorder.alpha = borderPulse;
  }

  public onJump(cb: (worldX: number, worldY: number) => void): void {
    this._onJump = cb;
  }

  public position(screenW: number, screenH: number): void {
    this.container.x = screenW - MAP_WIDTH - MAP_MARGIN;
    this.container.y = screenH - MAP_HEIGHT - MAP_MARGIN;
  }

  public destroy(): void {
    this.container.destroy({ children: true });
    this.zoneCountTexts.clear();
  }
}
