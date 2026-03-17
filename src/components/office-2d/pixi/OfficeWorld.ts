import { Container, Graphics, Text, TextStyle } from "pixi.js";
import {
  OFFICE,
  ZONES,
  SVG_WIDTH,
  SVG_HEIGHT,
} from "@/lib/constants";

// Dark theme colors (since we're going for the game aesthetic)
const BG_COLOR = 0x0a0e1a;
const FLOOR_COLORS: Record<string, number> = {
  desk: 0x1e293b,
  meeting: 0x1a2744,
  hotDesk: 0x1e2433,
  lounge: 0x231e33,
  corridor: 0x0f172a,
};
const WALL_COLOR = 0x475569;
const WALL_GLOW = 0x60a5fa;
const DOOR_COLOR = 0x0f172a;

// Furniture colors
const DESK_COLOR = 0x334155;
const DESK_TOP = 0x475569;
const CHAIR_COLOR = 0x374151;
const TABLE_COLOR = 0x3b4f6b;
const SOFA_COLOR = 0x4c1d95;
const PLANT_GREEN = 0x22c55e;
const PLANT_POT = 0x78350f;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  life: number;
  maxLife: number;
}

export class OfficeWorld {
  public readonly container: Container;

  private backgroundLayer: Container;
  private floorLayer: Container;
  private furnitureLayer: Container;
  private wallLayer: Container;
  private labelLayer: Container;
  private particleLayer: Container;
  private gridLayer: Container;

  private particles: Particle[] = [];
  private particleGraphics: Graphics;
  private _showGrid: boolean = false;
  private gridGraphics: Graphics;

  // Screen glow particles near desks
  private screenGlowParticles: Particle[] = [];

  constructor() {
    this.container = new Container();
    this.container.sortableChildren = true;

    this.backgroundLayer = new Container();
    this.backgroundLayer.zIndex = 0;

    this.floorLayer = new Container();
    this.floorLayer.zIndex = 1;

    this.furnitureLayer = new Container();
    this.furnitureLayer.zIndex = 2;

    this.wallLayer = new Container();
    this.wallLayer.zIndex = 3;

    this.labelLayer = new Container();
    this.labelLayer.zIndex = 4;

    this.particleLayer = new Container();
    this.particleLayer.zIndex = 5;

    this.gridLayer = new Container();
    this.gridLayer.zIndex = 6;
    this.gridLayer.visible = false;

    this.container.addChild(
      this.backgroundLayer,
      this.floorLayer,
      this.furnitureLayer,
      this.wallLayer,
      this.labelLayer,
      this.particleLayer,
      this.gridLayer,
    );

    this.particleGraphics = new Graphics();
    this.particleLayer.addChild(this.particleGraphics);

    this.gridGraphics = new Graphics();
    this.gridLayer.addChild(this.gridGraphics);

    this.buildBackground();
    this.buildFloors();
    this.buildWalls();
    this.buildDoors();
    this.buildFurniture();
    this.buildLabels();
    this.buildGrid();
    this.buildEntrance();
    this.initParticles();
  }

  private buildBackground(): void {
    const bg = new Graphics();
    // Main background
    bg.rect(0, 0, SVG_WIDTH, SVG_HEIGHT);
    bg.fill(BG_COLOR);

    // Starfield / subtle dots
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * SVG_WIDTH;
      const y = Math.random() * SVG_HEIGHT;
      const r = 0.5 + Math.random() * 1;
      bg.circle(x, y, r);
      bg.fill({ color: 0xffffff, alpha: 0.03 + Math.random() * 0.05 });
    }

    this.backgroundLayer.addChild(bg);
  }

  private buildFloors(): void {
    const g = new Graphics();

    // Building shell
    g.roundRect(
      OFFICE.x,
      OFFICE.y,
      OFFICE.width,
      OFFICE.height,
      OFFICE.cornerRadius,
    );
    g.fill(FLOOR_COLORS.corridor);

    // Corridor tiles (cross pattern)
    const cw = OFFICE.corridorWidth;
    const midX = OFFICE.x + (OFFICE.width - cw) / 2;
    const midY = OFFICE.y + (OFFICE.height - cw) / 2;

    // Horizontal corridor
    g.rect(OFFICE.x, midY, OFFICE.width, cw);
    g.fill(FLOOR_COLORS.corridor);

    // Vertical corridor
    g.rect(midX, OFFICE.y, cw, OFFICE.height);
    g.fill(FLOOR_COLORS.corridor);

    // Corridor tile pattern (subtle checkered)
    const tileSize = 14;
    for (let ty = OFFICE.y; ty < OFFICE.y + OFFICE.height; ty += tileSize) {
      for (let tx = OFFICE.x; tx < OFFICE.x + OFFICE.width; tx += tileSize) {
        const inHCorridor = ty >= midY && ty < midY + cw;
        const inVCorridor = tx >= midX && tx < midX + cw;
        if (inHCorridor || inVCorridor) {
          const checker = ((Math.floor(tx / tileSize) + Math.floor(ty / tileSize)) % 2) === 0;
          if (checker) {
            g.rect(tx, ty, tileSize, tileSize);
            g.fill({ color: 0x1a2540, alpha: 0.3 });
          }
        }
      }
    }

    // Corridor center dashed lines
    const dashG = new Graphics();
    // Horizontal center line
    for (let x = OFFICE.x; x < OFFICE.x + OFFICE.width; x += 14) {
      dashG.rect(x, midY + cw / 2 - 0.25, 8, 0.5);
      dashG.fill({ color: 0x334155, alpha: 0.6 });
    }
    // Vertical center line
    for (let y = OFFICE.y; y < OFFICE.y + OFFICE.height; y += 14) {
      dashG.rect(midX + cw / 2 - 0.25, y, 0.5, 8);
      dashG.fill({ color: 0x334155, alpha: 0.6 });
    }

    // Zone floors with subtle patterns
    for (const [key, zone] of Object.entries(ZONES)) {
      const color = FLOOR_COLORS[key] ?? 0x1e293b;

      // Base fill
      g.rect(zone.x, zone.y, zone.width, zone.height);
      g.fill(color);

      // Subtle inner gradient effect (lighter center)
      const cx = zone.x + zone.width / 2;
      const cy = zone.y + zone.height / 2;
      const innerW = zone.width * 0.7;
      const innerH = zone.height * 0.7;
      g.roundRect(cx - innerW / 2, cy - innerH / 2, innerW, innerH, 8);
      g.fill({ color: 0xffffff, alpha: 0.015 });

      // Zone floor texture pattern
      if (key === "lounge") {
        // Carpet dots
        for (let py = zone.y + 6; py < zone.y + zone.height; py += 12) {
          for (let px = zone.x + 6; px < zone.x + zone.width; px += 12) {
            g.circle(px, py, 0.8);
            g.fill({ color: 0x4c1d95, alpha: 0.15 });
          }
        }
      } else if (key === "desk" || key === "hotDesk") {
        // Subtle grid lines for desk areas
        for (let py = zone.y; py < zone.y + zone.height; py += 28) {
          g.rect(zone.x, py, zone.width, 0.3);
          g.fill({ color: 0xffffff, alpha: 0.02 });
        }
        for (let px = zone.x; px < zone.x + zone.width; px += 28) {
          g.rect(px, zone.y, 0.3, zone.height);
          g.fill({ color: 0xffffff, alpha: 0.02 });
        }
      } else if (key === "meeting") {
        // Subtle radial pattern
        for (let r = 20; r < Math.max(zone.width, zone.height); r += 30) {
          g.circle(cx, cy, r);
          g.stroke({ color: 0xffffff, width: 0.3, alpha: 0.02 });
        }
      }
    }

    this.floorLayer.addChild(g);
    this.floorLayer.addChild(dashG);
  }

  private buildWalls(): void {
    const g = new Graphics();
    const wallW = 4;
    const cw = OFFICE.corridorWidth;
    const midX = OFFICE.x + (OFFICE.width - cw) / 2;
    const midY = OFFICE.y + (OFFICE.height - cw) / 2;

    const walls = [
      // Vertical walls (left of corridor)
      { x: midX - wallW / 2, y: OFFICE.y, w: wallW, h: midY - OFFICE.y },
      { x: midX - wallW / 2, y: midY + cw, w: wallW, h: OFFICE.y + OFFICE.height - midY - cw },
      // Vertical walls (right of corridor)
      { x: midX + cw - wallW / 2, y: OFFICE.y, w: wallW, h: midY - OFFICE.y },
      { x: midX + cw - wallW / 2, y: midY + cw, w: wallW, h: OFFICE.y + OFFICE.height - midY - cw },
      // Horizontal walls (above corridor)
      { x: OFFICE.x, y: midY - wallW / 2, w: midX - OFFICE.x, h: wallW },
      { x: midX + cw, y: midY - wallW / 2, w: OFFICE.x + OFFICE.width - midX - cw, h: wallW },
      // Horizontal walls (below corridor)
      { x: OFFICE.x, y: midY + cw - wallW / 2, w: midX - OFFICE.x, h: wallW },
      { x: midX + cw, y: midY + cw - wallW / 2, w: OFFICE.x + OFFICE.width - midX - cw, h: wallW },
    ];

    // Wall fill
    for (const w of walls) {
      g.rect(w.x, w.y, w.w, w.h);
      g.fill(0x334155);
      g.stroke({ color: WALL_COLOR, width: 0.5 });
    }

    // Outer building wall
    g.roundRect(
      OFFICE.x,
      OFFICE.y,
      OFFICE.width,
      OFFICE.height,
      OFFICE.cornerRadius,
    );
    g.stroke({ color: WALL_COLOR, width: OFFICE.wallThickness });

    // Wall glow effect (subtle neon edges)
    const glowG = new Graphics();
    for (const w of walls) {
      glowG.rect(w.x - 1, w.y, w.w + 2, w.h);
      glowG.fill({ color: WALL_GLOW, alpha: 0.04 });
    }
    // Outer glow
    glowG.roundRect(
      OFFICE.x - 2,
      OFFICE.y - 2,
      OFFICE.width + 4,
      OFFICE.height + 4,
      OFFICE.cornerRadius + 2,
    );
    glowG.stroke({ color: WALL_GLOW, width: 2, alpha: 0.06 });

    this.wallLayer.addChild(g);
    this.wallLayer.addChild(glowG);
  }

  private buildDoors(): void {
    const g = new Graphics();
    const cw = OFFICE.corridorWidth;
    const midX = OFFICE.x + (OFFICE.width - cw) / 2;
    const midY = OFFICE.y + (OFFICE.height - cw) / 2;
    const doorWidth = 40;

    const doors = [
      { cx: (OFFICE.x + midX) / 2, cy: midY, horizontal: true },
      { cx: (midX + cw + OFFICE.x + OFFICE.width) / 2, cy: midY, horizontal: true },
      { cx: (OFFICE.x + midX) / 2, cy: midY + cw, horizontal: true },
      { cx: (midX + cw + OFFICE.x + OFFICE.width) / 2, cy: midY + cw, horizontal: true },
      { cx: midX, cy: (OFFICE.y + midY) / 2, horizontal: false },
      { cx: midX + cw, cy: (OFFICE.y + midY) / 2, horizontal: false },
      { cx: midX, cy: (midY + cw + OFFICE.y + OFFICE.height) / 2, horizontal: false },
      { cx: midX + cw, cy: (midY + cw + OFFICE.y + OFFICE.height) / 2, horizontal: false },
    ];

    for (const d of doors) {
      const half = doorWidth / 2;
      if (d.horizontal) {
        // Erase wall for door
        g.rect(d.cx - half, d.cy - 3, doorWidth, 6);
        g.fill(DOOR_COLOR);
        // Door arc (subtle)
        g.arc(d.cx, d.cy, half, Math.PI, 0);
        g.stroke({ color: 0x64748b, width: 0.8, alpha: 0.3 });
      } else {
        g.rect(d.cx - 3, d.cy - half, 6, doorWidth);
        g.fill(DOOR_COLOR);
        g.arc(d.cx, d.cy, half, -Math.PI / 2, Math.PI / 2);
        g.stroke({ color: 0x64748b, width: 0.8, alpha: 0.3 });
      }
    }

    this.wallLayer.addChild(g);
  }

  private buildFurniture(): void {
    const g = new Graphics();

    // === Desk Zone Furniture ===
    const dz = ZONES.desk;
    const deskW = 80;
    const deskH = 30;
    const deskPadX = 30;
    const deskPadY = 40;
    const deskCols = 3;
    const deskRows = 3;
    const deskSpacingX = (dz.width - deskPadX * 2) / deskCols;
    const deskSpacingY = (dz.height - deskPadY * 2) / deskRows;

    for (let row = 0; row < deskRows; row++) {
      for (let col = 0; col < deskCols; col++) {
        const dx = dz.x + deskPadX + col * deskSpacingX + deskSpacingX / 2 - deskW / 2;
        const dy = dz.y + deskPadY + row * deskSpacingY + deskSpacingY / 2 - deskH / 2;
        this.drawDesk(g, dx, dy, deskW, deskH);
        // Chair
        this.drawChair(g, dx + deskW / 2, dy + deskH + 10);
        // Monitor glow
        g.rect(dx + deskW / 2 - 8, dy + 4, 16, 10);
        g.fill({ color: 0x3b82f6, alpha: 0.15 });
        g.rect(dx + deskW / 2 - 6, dy + 5, 12, 8);
        g.fill({ color: 0x60a5fa, alpha: 0.1 });
      }
    }

    // === Hot Desk Zone Furniture ===
    const hz = ZONES.hotDesk;
    const hotDeskCols = 3;
    const hotDeskRows = 2;
    const hSpacingX = (hz.width - 60) / hotDeskCols;
    const hSpacingY = (hz.height - 60) / hotDeskRows;

    for (let row = 0; row < hotDeskRows; row++) {
      for (let col = 0; col < hotDeskCols; col++) {
        const hx = hz.x + 30 + col * hSpacingX + hSpacingX / 2 - 35;
        const hy = hz.y + 30 + row * hSpacingY + hSpacingY / 2 - 15;
        this.drawDesk(g, hx, hy, 70, 25);
        this.drawChair(g, hx + 35, hy + 35);
      }
    }

    // === Meeting Room ===
    const mz = ZONES.meeting;
    const mcx = mz.x + mz.width / 2;
    const mcy = mz.y + mz.height / 2;
    const tableRadius = 60;

    // Round meeting table
    g.circle(mcx, mcy, tableRadius);
    g.fill({ color: TABLE_COLOR, alpha: 0.8 });
    g.stroke({ color: 0x64748b, width: 2 });
    // Table top highlight
    g.circle(mcx, mcy, tableRadius - 6);
    g.fill({ color: 0xffffff, alpha: 0.03 });
    // Center emblem
    g.circle(mcx, mcy, 15);
    g.fill({ color: 0x60a5fa, alpha: 0.1 });
    g.stroke({ color: 0x60a5fa, width: 1, alpha: 0.2 });

    // Meeting chairs around table
    const chairCount = 8;
    const chairRadius = tableRadius + 25;
    for (let i = 0; i < chairCount; i++) {
      const angle = (Math.PI * 2 * i) / chairCount - Math.PI / 2;
      const cx = mcx + Math.cos(angle) * chairRadius;
      const cy = mcy + Math.sin(angle) * chairRadius;
      this.drawChair(g, cx, cy);
    }

    // Whiteboard on meeting room wall
    g.roundRect(mz.x + mz.width - 80, mz.y + 20, 60, 40, 3);
    g.fill({ color: 0xffffff, alpha: 0.05 });
    g.stroke({ color: 0x64748b, width: 1 });

    // === Lounge ===
    const lz = ZONES.lounge;

    // Sofas
    this.drawSofa(g, lz.x + 80, lz.y + 50, 100, 40, false);
    this.drawSofa(g, lz.x + 250, lz.y + 50, 100, 40, false);
    this.drawSofa(g, lz.x + 80, lz.y + 130, 100, 40, true);
    this.drawSofa(g, lz.x + 400, lz.y + 80, 40, 80, false);

    // Coffee tables
    g.roundRect(lz.x + 120, lz.y + 90, 40, 30, 4);
    g.fill({ color: 0x78350f, alpha: 0.6 });
    g.stroke({ color: 0x92400e, width: 1 });

    g.roundRect(lz.x + 290, lz.y + 90, 40, 30, 4);
    g.fill({ color: 0x78350f, alpha: 0.6 });
    g.stroke({ color: 0x92400e, width: 1 });

    // Logo wall
    const logoCX = lz.x + lz.width / 2;
    const logoY = lz.y + lz.height * 0.52;
    g.roundRect(logoCX - 100, logoY, 200, 36, 4);
    g.fill(0x3b4f6b);
    // Top accent
    g.roundRect(logoCX - 100, logoY, 200, 3, 1.5);
    g.fill({ color: 0x60a5fa, alpha: 0.5 });

    // Reception desk
    const rdY = logoY + 50;
    g.roundRect(logoCX - 80, rdY, 160, 24, 12);
    g.fill(DESK_COLOR);
    g.stroke({ color: WALL_COLOR, width: 1 });
    g.roundRect(logoCX - 76, rdY + 3, 152, 18, 9);
    g.fill({ color: DESK_TOP, alpha: 0.5 });

    // Plants
    this.drawPlant(g, logoCX - 130, logoY + 18);
    this.drawPlant(g, logoCX + 130, logoY + 18);
    this.drawPlant(g, lz.x + 40, lz.y + lz.height - 50);
    this.drawPlant(g, lz.x + lz.width - 40, lz.y + lz.height - 50);

    // Plants in desk zone
    this.drawPlant(g, dz.x + 20, dz.y + 20);
    this.drawPlant(g, dz.x + dz.width - 20, dz.y + 20);

    this.furnitureLayer.addChild(g);

    // Logo text (separate since Text object)
    const logoText = new Text({
      text: "OpenClaw",
      style: new TextStyle({
        fontSize: 14,
        fontFamily: "monospace",
        fill: 0x94a3b8,
        fontWeight: "bold",
        letterSpacing: 2,
      }),
    });
    logoText.anchor.set(0.5, 0.5);
    logoText.x = logoCX;
    logoText.y = logoY + 20;
    this.furnitureLayer.addChild(logoText);
  }

  private drawDesk(g: Graphics, x: number, y: number, w: number, h: number): void {
    // Desk shadow
    g.roundRect(x + 2, y + 2, w, h, 3);
    g.fill({ color: 0x000000, alpha: 0.2 });
    // Desk body
    g.roundRect(x, y, w, h, 3);
    g.fill(DESK_COLOR);
    g.stroke({ color: 0x475569, width: 1 });
    // Desk surface
    g.roundRect(x + 2, y + 2, w - 4, h - 4, 2);
    g.fill({ color: DESK_TOP, alpha: 0.4 });
  }

  private drawChair(g: Graphics, cx: number, cy: number): void {
    g.circle(cx, cy, 8);
    g.fill(CHAIR_COLOR);
    g.stroke({ color: 0x4b5563, width: 1 });
    // Seat center
    g.circle(cx, cy, 4);
    g.fill({ color: 0x4b5563, alpha: 0.5 });
  }

  private drawSofa(g: Graphics, x: number, y: number, w: number, h: number, flipped: boolean): void {
    // Shadow
    g.roundRect(x + 2, y + 2, w, h, 6);
    g.fill({ color: 0x000000, alpha: 0.15 });
    // Body
    g.roundRect(x, y, w, h, 6);
    g.fill(SOFA_COLOR);
    g.stroke({ color: 0x6d28d9, width: 1 });
    // Cushion lines
    const cushions = 3;
    const cw = (w - 8) / cushions;
    for (let i = 1; i < cushions; i++) {
      const lx = x + 4 + i * cw;
      g.moveTo(lx, y + 4);
      g.lineTo(lx, y + h - 4);
      g.stroke({ color: 0x7c3aed, width: 0.5, alpha: 0.4 });
    }
    // Back rest
    if (!flipped) {
      g.roundRect(x + 2, y, w - 4, 6, 3);
      g.fill({ color: 0x5b21b6, alpha: 0.5 });
    } else {
      g.roundRect(x + 2, y + h - 6, w - 4, 6, 3);
      g.fill({ color: 0x5b21b6, alpha: 0.5 });
    }
  }

  private drawPlant(g: Graphics, cx: number, cy: number): void {
    // Pot
    g.roundRect(cx - 6, cy, 12, 10, 2);
    g.fill(PLANT_POT);
    // Leaves
    g.circle(cx, cy - 4, 8);
    g.fill({ color: PLANT_GREEN, alpha: 0.7 });
    g.circle(cx - 5, cy - 2, 5);
    g.fill({ color: 0x16a34a, alpha: 0.6 });
    g.circle(cx + 5, cy - 2, 5);
    g.fill({ color: 0x15803d, alpha: 0.6 });
  }

  private buildLabels(): void {
    const labelStyle = new TextStyle({
      fontSize: 11,
      fontFamily: "monospace",
      fill: 0x94a3b8,
      fontWeight: "bold",
      letterSpacing: 1.5,
    });

    for (const [_key, zone] of Object.entries(ZONES)) {
      const label = new Text({
        text: zone.label.toUpperCase(),
        style: labelStyle,
      });
      label.anchor.set(0.5, 0);
      label.x = zone.x + zone.width / 2;
      label.y = zone.y + 8;
      label.alpha = 0.5;
      this.labelLayer.addChild(label);
    }
  }

  private buildGrid(): void {
    const g = this.gridGraphics;
    const step = 28;

    for (let x = OFFICE.x; x < OFFICE.x + OFFICE.width; x += step) {
      g.moveTo(x, OFFICE.y);
      g.lineTo(x, OFFICE.y + OFFICE.height);
      g.stroke({ color: 0xffffff, width: 0.3, alpha: 0.05 });
    }
    for (let y = OFFICE.y; y < OFFICE.y + OFFICE.height; y += step) {
      g.moveTo(OFFICE.x, y);
      g.lineTo(OFFICE.x + OFFICE.width, y);
      g.stroke({ color: 0xffffff, width: 0.3, alpha: 0.05 });
    }
  }

  private buildEntrance(): void {
    const lz = ZONES.lounge;
    const doorCX = lz.x + lz.width / 2;
    const doorY = OFFICE.y + OFFICE.height;
    const doorW = 70;
    const half = doorW / 2;

    const g = new Graphics();

    // Erase wall for door opening
    g.rect(doorCX - half - 2, doorY - OFFICE.wallThickness - 1, doorW + 4, OFFICE.wallThickness + 4);
    g.fill(0x231e33);

    // Door frame posts
    g.rect(doorCX - half - 3, doorY - 10, 3, 12);
    g.fill(0x64748b);
    g.rect(doorCX + half, doorY - 10, 3, 12);
    g.fill(0x64748b);

    // Welcome mat
    g.roundRect(doorCX - 30, doorY - 18, 60, 12, 3);
    g.fill({ color: 0x374151, alpha: 0.5 });

    this.wallLayer.addChild(g);

    // Entrance label
    const entranceLabel = new Text({
      text: "ENTRANCE",
      style: new TextStyle({
        fontSize: 9,
        fontFamily: "monospace",
        fill: 0x64748b,
        fontWeight: "bold",
        letterSpacing: 2,
      }),
    });
    entranceLabel.anchor.set(0.5, 0);
    entranceLabel.x = doorCX;
    entranceLabel.y = doorY + 6;
    this.wallLayer.addChild(entranceLabel);

    // Glowing entrance indicator
    const glowG = new Graphics();
    glowG.rect(doorCX - half, doorY - 2, doorW, 2);
    glowG.fill({ color: 0x60a5fa, alpha: 0.3 });
    this.wallLayer.addChild(glowG);
  }

  private initParticles(): void {
    // Dust motes in lounge
    const lz = ZONES.lounge;
    for (let i = 0; i < 25; i++) {
      this.particles.push({
        x: lz.x + Math.random() * lz.width,
        y: lz.y + Math.random() * lz.height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -0.05 - Math.random() * 0.1,
        alpha: 0.1 + Math.random() * 0.2,
        size: 0.5 + Math.random() * 1.5,
        life: Math.random() * 200,
        maxLife: 200 + Math.random() * 200,
      });
    }

    // Screen glow particles near desks
    const dz = ZONES.desk;
    for (let i = 0; i < 15; i++) {
      this.screenGlowParticles.push({
        x: dz.x + 20 + Math.random() * (dz.width - 40),
        y: dz.y + 20 + Math.random() * (dz.height - 40),
        vx: (Math.random() - 0.5) * 0.1,
        vy: -0.1 - Math.random() * 0.1,
        alpha: 0.05 + Math.random() * 0.1,
        size: 1 + Math.random() * 2,
        life: Math.random() * 300,
        maxLife: 300 + Math.random() * 200,
      });
    }
  }

  public toggleGrid(): void {
    this._showGrid = !this._showGrid;
    this.gridLayer.visible = this._showGrid;
  }

  public tick(dt: number): void {
    this.particleGraphics.clear();

    const lz = ZONES.lounge;
    const dz = ZONES.desk;

    // Update and draw dust motes
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life += dt;

      if (p.life > p.maxLife || p.y < lz.y || p.x < lz.x || p.x > lz.x + lz.width) {
        p.x = lz.x + Math.random() * lz.width;
        p.y = lz.y + lz.height;
        p.life = 0;
        p.vx = (Math.random() - 0.5) * 0.15;
        p.vy = -0.05 - Math.random() * 0.1;
      }

      const fadeIn = Math.min(p.life / 30, 1);
      const fadeOut = Math.max(0, 1 - (p.life - p.maxLife + 30) / 30);
      const alpha = p.alpha * fadeIn * fadeOut;

      this.particleGraphics.circle(p.x, p.y, p.size);
      this.particleGraphics.fill({ color: 0xffffff, alpha });
    }

    // Screen glow particles
    for (const p of this.screenGlowParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life += dt;

      if (p.life > p.maxLife || p.y < dz.y) {
        p.x = dz.x + 20 + Math.random() * (dz.width - 40);
        p.y = dz.y + dz.height - 20;
        p.life = 0;
      }

      const fadeIn = Math.min(p.life / 50, 1);
      const fadeOut = Math.max(0, 1 - (p.life - p.maxLife + 50) / 50);
      const alpha = p.alpha * fadeIn * fadeOut;

      this.particleGraphics.circle(p.x, p.y, p.size);
      this.particleGraphics.fill({ color: 0x3b82f6, alpha });
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
