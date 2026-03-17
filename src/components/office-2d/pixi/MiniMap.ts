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

export class MiniMap {
  public readonly container: Container;

  private bg: Graphics;
  private zoneGraphics: Graphics;
  private agentGraphics: Graphics;
  private viewportRect: Graphics;

  private _onJump: ((worldX: number, worldY: number) => void) | null = null;

  constructor() {
    this.container = new Container();
    this.container.sortableChildren = true;

    // Background — dark frosted panel
    this.bg = new Graphics();
    this.bg.roundRect(0, 0, MAP_WIDTH, MAP_HEIGHT, 8);
    this.bg.fill({ color: 0x0d0d1a, alpha: 0.9 });
    this.bg.stroke({ color: 0x3a3a5a, width: 1, alpha: 0.5 });
    this.bg.zIndex = 0;
    this.container.addChild(this.bg);

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
        fill: 0x6a6a8a,
        fontWeight: "bold",
        letterSpacing: 1.5,
      }),
    });
    title.x = MAP_WIDTH / 2;
    title.y = 2;
    title.anchor.set(0.5, 0);
    title.zIndex = 4;
    this.container.addChild(title);

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

  public onJump(cb: (worldX: number, worldY: number) => void): void {
    this._onJump = cb;
  }

  public position(screenW: number, screenH: number): void {
    this.container.x = screenW - MAP_WIDTH - MAP_MARGIN;
    this.container.y = screenH - MAP_HEIGHT - MAP_MARGIN;
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
