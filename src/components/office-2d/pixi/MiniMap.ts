import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { OFFICE, ZONES, SVG_WIDTH, SVG_HEIGHT, STATUS_COLORS } from "@/lib/constants";
import type { VisualAgent } from "@/gateway/types";

const MAP_WIDTH = 160;
const MAP_HEIGHT = 90;
const MAP_MARGIN = 10;
const MAP_PADDING = 4;

// Scale from world coords to minimap
const SCALE_X = (MAP_WIDTH - MAP_PADDING * 2) / SVG_WIDTH;
const SCALE_Y = (MAP_HEIGHT - MAP_PADDING * 2) / SVG_HEIGHT;

const ZONE_MINIMAP_COLORS: Record<string, number> = {
  desk: 0x1e293b,
  meeting: 0x1a2744,
  hotDesk: 0x1e2433,
  lounge: 0x231e33,
};

export class MiniMap {
  public readonly container: Container;

  private bg: Graphics;
  private zoneGraphics: Graphics;
  private agentGraphics: Graphics;
  private viewportRect: Graphics;

  // For click-to-jump
  private _onJump: ((worldX: number, worldY: number) => void) | null = null;


  constructor() {
    this.container = new Container();
    this.container.sortableChildren = true;

    // Background
    this.bg = new Graphics();
    this.bg.roundRect(0, 0, MAP_WIDTH, MAP_HEIGHT, 6);
    this.bg.fill({ color: 0x0a0e1a, alpha: 0.85 });
    this.bg.stroke({ color: 0x334155, width: 1 });
    this.bg.zIndex = 0;
    this.container.addChild(this.bg);

    // Zone colors
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
        fontFamily: "monospace",
        fill: 0x64748b,
        fontWeight: "bold",
        letterSpacing: 1,
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
      2,
    );
    this.zoneGraphics.fill({ color: 0x0f172a, alpha: 0.8 });

    // Zone fills
    for (const [key, zone] of Object.entries(ZONES)) {
      const color = ZONE_MINIMAP_COLORS[key] ?? 0x1e293b;
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
      const color = STATUS_COLORS[agent.status] ?? "#6b7280";
      const hex = parseInt(color.replace("#", ""), 16);
      const mx = MAP_PADDING + agent.position.x * SCALE_X;
      const my = MAP_PADDING + agent.position.y * SCALE_Y;

      // Glow
      this.agentGraphics.circle(mx, my, 3);
      this.agentGraphics.fill({ color: hex, alpha: 0.3 });
      // Dot
      this.agentGraphics.circle(mx, my, 1.5);
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
    this.viewportRect.stroke({ color: 0x60a5fa, width: 1, alpha: 0.8 });
    this.viewportRect.fill({ color: 0x60a5fa, alpha: 0.05 });
  }

  public onJump(cb: (worldX: number, worldY: number) => void): void {
    this._onJump = cb;
  }

  /** Position the minimap in the bottom-right of the screen */
  public position(screenW: number, screenH: number): void {
    this.container.x = screenW - MAP_WIDTH - MAP_MARGIN;
    this.container.y = screenH - MAP_HEIGHT - MAP_MARGIN;
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
