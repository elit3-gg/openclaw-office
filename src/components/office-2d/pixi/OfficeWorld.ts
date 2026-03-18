import { Container, Graphics, Text, TextStyle } from "pixi.js";
import {
  OFFICE,
  ZONES,
  SVG_WIDTH,
  SVG_HEIGHT,
} from "@/lib/constants";

// ═══════════════════════════════════════════════════════════
// Gather.town-inspired dark office world
// Tile-based floor, warm ambient lighting, cozy pixel-art feel
// Now with richer furniture, ambient animations, and more life!
// ═══════════════════════════════════════════════════════════

// Color palette — warm dark theme (Gather.town inspired)
const FLOOR_BASE = 0x2d2d44;          // Main floor color
const FLOOR_DESK = 0x2a2a42;          // Desk zone floor
const FLOOR_MEETING = 0x2e2844;       // Meeting zone floor (subtle purple)
const FLOOR_HOTDESK = 0x2a2d40;       // Hot desk floor
const FLOOR_LOUNGE = 0x332844;        // Lounge floor (warm purple)
const CORRIDOR_COLOR = 0x252540;      // Corridor (darker)

const WALL_BASE = 0x4a4a6a;           // Wall fill
const WALL_BORDER = 0x6a6a8a;         // Wall edge
const WALL_GLOW_COLOR = 0x7c6ff5;     // Subtle purple glow on walls

// Furniture palette
const DESK_WOOD = 0x5c4a3a;           // Warm wood desk
const DESK_TOP_COLOR = 0x7a6a5a;      // Desk surface
const DESK_SHADOW = 0x3a3020;         // Desk shadow
const CHAIR_BASE = 0x4a4a5a;          // Chair seat
const TABLE_COLOR = 0x5a5060;         // Meeting table
const SOFA_PRIMARY = 0x6a3a8a;        // Sofa purple
const SOFA_CUSHION = 0x7a4a9a;        // Sofa cushion
const PLANT_DARK = 0x2a6a3a;          // Plant dark green
const PLANT_LIGHT = 0x3a8a4a;         // Plant light green
const PLANT_POT_COLOR = 0x6a4a2a;     // Plant pot

// Accent colors
const ACCENT_BLUE = 0x5a7aff;         // Blue accent (screens, indicators)
const ACCENT_CYAN = 0x4adeae;         // Cyan accent (secondary)
const ACCENT_WARM = 0xffa64a;         // Warm orange accent
const ACCENT_PURPLE = 0x9a6aff;       // Purple accent

// Monitor / screen glow
const SCREEN_GLOW = 0x4a8aff;
const SCREEN_FACE = 0x3a6aee;

// Tile size for the floor grid
const TILE_SIZE = 16;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  life: number;
  maxLife: number;
  color: number;
}

interface SteamParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  life: number;
}

interface GlowingObject {
  graphics: Graphics;
  baseAlpha: number;
  phase: number;
  speed: number;
  color: number;
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
  private ambientLayer: Container;
  private decorLayer: Container;

  private particles: Particle[] = [];
  private steamParticles: SteamParticle[] = [];
  private particleGraphics: Graphics;
  private steamGraphics: Graphics;
  private _showGrid: boolean = false;
  private gridGraphics: Graphics;
  private ambientGraphics: Graphics;
  private ambientPhase: number = 0;

  // Glowing objects for ambient life
  private glowingObjects: GlowingObject[] = [];
  
  // Ceiling lights
  private ceilingLights: { x: number; y: number; graphics: Graphics }[] = [];

  constructor() {
    this.container = new Container();
    this.container.sortableChildren = true;

    this.backgroundLayer = new Container();
    this.backgroundLayer.zIndex = 0;

    this.floorLayer = new Container();
    this.floorLayer.zIndex = 1;

    this.furnitureLayer = new Container();
    this.furnitureLayer.zIndex = 2;

    this.decorLayer = new Container();
    this.decorLayer.zIndex = 3;

    this.wallLayer = new Container();
    this.wallLayer.zIndex = 4;

    this.labelLayer = new Container();
    this.labelLayer.zIndex = 5;

    this.ambientLayer = new Container();
    this.ambientLayer.zIndex = 6;

    this.particleLayer = new Container();
    this.particleLayer.zIndex = 7;

    this.gridLayer = new Container();
    this.gridLayer.zIndex = 8;
    this.gridLayer.visible = false;

    this.container.addChild(
      this.backgroundLayer,
      this.floorLayer,
      this.furnitureLayer,
      this.decorLayer,
      this.wallLayer,
      this.labelLayer,
      this.ambientLayer,
      this.particleLayer,
      this.gridLayer,
    );

    this.particleGraphics = new Graphics();
    this.particleLayer.addChild(this.particleGraphics);

    this.steamGraphics = new Graphics();
    this.particleLayer.addChild(this.steamGraphics);

    this.gridGraphics = new Graphics();
    this.gridLayer.addChild(this.gridGraphics);

    this.ambientGraphics = new Graphics();
    this.ambientLayer.addChild(this.ambientGraphics);

    this.buildBackground();
    this.buildFloors();
    this.buildWalls();
    this.buildDoors();
    this.buildFurniture();
    this.buildDecorations();
    this.buildCeilingLights();
    this.buildLabels();
    this.buildGrid();
    this.buildEntrance();
    this.buildAmbientLighting();
    this.initParticles();
    this.initSteamParticles();
  }

  // ─── BACKGROUND ───────────────────────────────────────────

  private buildBackground(): void {
    const bg = new Graphics();

    // Deep space background extending beyond the office
    bg.rect(-100, -100, SVG_WIDTH + 200, SVG_HEIGHT + 200);
    bg.fill(0x0d0d1a);

    // Subtle starfield / dust motes in the void
    for (let i = 0; i < 120; i++) {
      const x = -50 + Math.random() * (SVG_WIDTH + 100);
      const y = -50 + Math.random() * (SVG_HEIGHT + 100);
      const r = 0.3 + Math.random() * 0.8;
      bg.circle(x, y, r);
      bg.fill({ color: 0xffffff, alpha: 0.02 + Math.random() * 0.04 });
    }

    this.backgroundLayer.addChild(bg);
  }

  // ─── FLOORS ───────────────────────────────────────────────

  private buildFloors(): void {
    const g = new Graphics();

    // Building shell — rounded outer floor
    g.roundRect(
      OFFICE.x,
      OFFICE.y,
      OFFICE.width,
      OFFICE.height,
      OFFICE.cornerRadius,
    );
    g.fill(CORRIDOR_COLOR);

    // Corridor tiles with subtle checkered pattern
    const cw = OFFICE.corridorWidth;
    const midX = OFFICE.x + (OFFICE.width - cw) / 2;
    const midY = OFFICE.y + (OFFICE.height - cw) / 2;

    // Horizontal corridor
    g.rect(OFFICE.x, midY, OFFICE.width, cw);
    g.fill(CORRIDOR_COLOR);

    // Vertical corridor
    g.rect(midX, OFFICE.y, cw, OFFICE.height);
    g.fill(CORRIDOR_COLOR);

    // Corridor tile pattern — cozy checkered
    for (let ty = OFFICE.y; ty < OFFICE.y + OFFICE.height; ty += TILE_SIZE) {
      for (let tx = OFFICE.x; tx < OFFICE.x + OFFICE.width; tx += TILE_SIZE) {
        const inHCorridor = ty >= midY && ty < midY + cw;
        const inVCorridor = tx >= midX && tx < midX + cw;
        if (inHCorridor || inVCorridor) {
          const checker = ((Math.floor(tx / TILE_SIZE) + Math.floor(ty / TILE_SIZE)) % 2) === 0;
          if (checker) {
            g.rect(tx, ty, TILE_SIZE, TILE_SIZE);
            g.fill({ color: 0x1f1f38, alpha: 0.4 });
          }
        }
      }
    }

    // Corridor center dashed lines (path guides like Gather)
    const dashG = new Graphics();
    for (let x = OFFICE.x; x < OFFICE.x + OFFICE.width; x += 16) {
      dashG.rect(x, midY + cw / 2 - 0.3, 8, 0.6);
      dashG.fill({ color: 0x4a4a6a, alpha: 0.3 });
    }
    for (let y = OFFICE.y; y < OFFICE.y + OFFICE.height; y += 16) {
      dashG.rect(midX + cw / 2 - 0.3, y, 0.6, 8);
      dashG.fill({ color: 0x4a4a6a, alpha: 0.3 });
    }

    // Zone floors with tile patterns
    const zoneColors: Record<string, number> = {
      desk: FLOOR_DESK,
      meeting: FLOOR_MEETING,
      hotDesk: FLOOR_HOTDESK,
      lounge: FLOOR_LOUNGE,
    };

    for (const [key, zone] of Object.entries(ZONES)) {
      const color = zoneColors[key] ?? FLOOR_BASE;

      // Base fill
      g.rect(zone.x, zone.y, zone.width, zone.height);
      g.fill(color);

      // Tile grid pattern (gives that Gather.town pixelated floor feel)
      for (let ty = zone.y; ty < zone.y + zone.height; ty += TILE_SIZE) {
        for (let tx = zone.x; tx < zone.x + zone.width; tx += TILE_SIZE) {
          const tileX = Math.floor(tx / TILE_SIZE);
          const tileY = Math.floor(ty / TILE_SIZE);

          // Alternating tile pattern
          if ((tileX + tileY) % 2 === 0) {
            g.rect(tx, ty, TILE_SIZE, TILE_SIZE);
            g.fill({ color: 0xffffff, alpha: 0.015 });
          }

          // Tile border (very subtle grid lines)
          g.rect(tx, ty, TILE_SIZE, 0.3);
          g.fill({ color: 0x000000, alpha: 0.06 });
          g.rect(tx, ty, 0.3, TILE_SIZE);
          g.fill({ color: 0x000000, alpha: 0.06 });
        }
      }

      // Zone-specific floor texture
      if (key === "lounge") {
        // Carpet pattern — circular dots
        for (let py = zone.y + 8; py < zone.y + zone.height; py += 16) {
          for (let px = zone.x + 8; px < zone.x + zone.width; px += 16) {
            g.circle(px, py, 1);
            g.fill({ color: SOFA_PRIMARY, alpha: 0.08 });
          }
        }

        // Warm area rug in center
        const rugX = zone.x + zone.width * 0.15;
        const rugY = zone.y + zone.height * 0.15;
        const rugW = zone.width * 0.7;
        const rugH = zone.height * 0.35;
        g.roundRect(rugX, rugY, rugW, rugH, 8);
        g.fill({ color: 0x3a2a48, alpha: 0.4 });
        // Rug border
        g.roundRect(rugX + 3, rugY + 3, rugW - 6, rugH - 6, 6);
        g.stroke({ color: ACCENT_PURPLE, width: 0.5, alpha: 0.15 });
        // Rug center pattern
        g.circle(rugX + rugW / 2, rugY + rugH / 2, 25);
        g.stroke({ color: 0x7a6aaa, width: 1, alpha: 0.12 });
        g.circle(rugX + rugW / 2, rugY + rugH / 2, 15);
        g.fill({ color: 0x5a4a7a, alpha: 0.15 });

      } else if (key === "desk" || key === "hotDesk") {
        // Subtle tech grid for work areas
        for (let py = zone.y; py < zone.y + zone.height; py += 32) {
          g.rect(zone.x, py, zone.width, 0.3);
          g.fill({ color: ACCENT_BLUE, alpha: 0.02 });
        }
        for (let px = zone.x; px < zone.x + zone.width; px += 32) {
          g.rect(px, zone.y, 0.3, zone.height);
          g.fill({ color: ACCENT_BLUE, alpha: 0.02 });
        }
      } else if (key === "meeting") {
        // Radial pattern for meeting room
        const cx = zone.x + zone.width / 2;
        const cy = zone.y + zone.height / 2;
        for (let r = 30; r < Math.max(zone.width, zone.height); r += 35) {
          g.circle(cx, cy, r);
          g.stroke({ color: 0xffffff, width: 0.3, alpha: 0.015 });
        }
      }

      // Inner glow / lighter center
      const cx = zone.x + zone.width / 2;
      const cy = zone.y + zone.height / 2;
      const innerW = zone.width * 0.6;
      const innerH = zone.height * 0.6;
      g.roundRect(cx - innerW / 2, cy - innerH / 2, innerW, innerH, 12);
      g.fill({ color: 0xffffff, alpha: 0.01 });
    }

    this.floorLayer.addChild(g);
    this.floorLayer.addChild(dashG);
  }

  // ─── WALLS ────────────────────────────────────────────────

  private buildWalls(): void {
    const g = new Graphics();
    const wallW = 5;
    const cw = OFFICE.corridorWidth;
    const midX = OFFICE.x + (OFFICE.width - cw) / 2;
    const midY = OFFICE.y + (OFFICE.height - cw) / 2;

    const walls = [
      { x: midX - wallW / 2, y: OFFICE.y, w: wallW, h: midY - OFFICE.y },
      { x: midX - wallW / 2, y: midY + cw, w: wallW, h: OFFICE.y + OFFICE.height - midY - cw },
      { x: midX + cw - wallW / 2, y: OFFICE.y, w: wallW, h: midY - OFFICE.y },
      { x: midX + cw - wallW / 2, y: midY + cw, w: wallW, h: OFFICE.y + OFFICE.height - midY - cw },
      { x: OFFICE.x, y: midY - wallW / 2, w: midX - OFFICE.x, h: wallW },
      { x: midX + cw, y: midY - wallW / 2, w: OFFICE.x + OFFICE.width - midX - cw, h: wallW },
      { x: OFFICE.x, y: midY + cw - wallW / 2, w: midX - OFFICE.x, h: wallW },
      { x: midX + cw, y: midY + cw - wallW / 2, w: OFFICE.x + OFFICE.width - midX - cw, h: wallW },
    ];

    // Wall shadows (cast below)
    for (const w of walls) {
      g.rect(w.x + 1, w.y + 2, w.w, w.h);
      g.fill({ color: 0x000000, alpha: 0.2 });
    }

    // Wall fills
    for (const w of walls) {
      g.rect(w.x, w.y, w.w, w.h);
      g.fill(WALL_BASE);
      // Top edge highlight
      if (w.h > w.w) {
        // Vertical wall
        g.rect(w.x, w.y, 1, w.h);
        g.fill({ color: WALL_BORDER, alpha: 0.6 });
      } else {
        // Horizontal wall
        g.rect(w.x, w.y, w.w, 1);
        g.fill({ color: WALL_BORDER, alpha: 0.6 });
      }
    }

    // Outer building wall — thick and prominent
    g.roundRect(
      OFFICE.x,
      OFFICE.y,
      OFFICE.width,
      OFFICE.height,
      OFFICE.cornerRadius,
    );
    g.stroke({ color: WALL_BORDER, width: OFFICE.wallThickness });

    // Wall glow effect (subtle neon edges — Gather style)
    const glowG = new Graphics();
    for (const w of walls) {
      glowG.rect(w.x - 2, w.y - 1, w.w + 4, w.h + 2);
      glowG.fill({ color: WALL_GLOW_COLOR, alpha: 0.025 });
    }
    // Outer glow
    glowG.roundRect(
      OFFICE.x - 3,
      OFFICE.y - 3,
      OFFICE.width + 6,
      OFFICE.height + 6,
      OFFICE.cornerRadius + 3,
    );
    glowG.stroke({ color: WALL_GLOW_COLOR, width: 3, alpha: 0.04 });

    this.wallLayer.addChild(g);
    this.wallLayer.addChild(glowG);
  }

  // ─── DOORS ────────────────────────────────────────────────

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
        // Door opening
        g.rect(d.cx - half, d.cy - 4, doorWidth, 8);
        g.fill(CORRIDOR_COLOR);
        // Door mat (warm accent)
        g.roundRect(d.cx - 12, d.cy - 2, 24, 4, 2);
        g.fill({ color: ACCENT_WARM, alpha: 0.08 });
        // Door frame edges
        g.rect(d.cx - half, d.cy - 4, 2, 8);
        g.fill({ color: WALL_BORDER, alpha: 0.4 });
        g.rect(d.cx + half - 2, d.cy - 4, 2, 8);
        g.fill({ color: WALL_BORDER, alpha: 0.4 });
      } else {
        g.rect(d.cx - 4, d.cy - half, 8, doorWidth);
        g.fill(CORRIDOR_COLOR);
        g.roundRect(d.cx - 2, d.cy - 12, 4, 24, 2);
        g.fill({ color: ACCENT_WARM, alpha: 0.08 });
        g.rect(d.cx - 4, d.cy - half, 8, 2);
        g.fill({ color: WALL_BORDER, alpha: 0.4 });
        g.rect(d.cx - 4, d.cy + half - 2, 8, 2);
        g.fill({ color: WALL_BORDER, alpha: 0.4 });
      }
    }

    this.wallLayer.addChild(g);
  }

  // ─── FURNITURE ────────────────────────────────────────────

  private buildFurniture(): void {
    const g = new Graphics();

    // ══ DESK ZONE ══
    const dz = ZONES.desk;
    const deskW = 80;
    const deskH = 32;
    const deskPadX = 35;
    const deskPadY = 45;
    const deskCols = 3;
    const deskRows = 3;
    const deskSpacingX = (dz.width - deskPadX * 2) / deskCols;
    const deskSpacingY = (dz.height - deskPadY * 2) / deskRows;

    for (let row = 0; row < deskRows; row++) {
      for (let col = 0; col < deskCols; col++) {
        const dx = dz.x + deskPadX + col * deskSpacingX + deskSpacingX / 2 - deskW / 2;
        const dy = dz.y + deskPadY + row * deskSpacingY + deskSpacingY / 2 - deskH / 2;
        this.drawDesk(g, dx, dy, deskW, deskH);
        this.drawChair(g, dx + deskW / 2, dy + deskH + 12);
        this.drawMonitor(g, dx + deskW / 2, dy + 6);
      }
    }

    // ══ HOT DESK ZONE ══
    const hz = ZONES.hotDesk;
    const hotCols = 3;
    const hotRows = 2;
    const hSpX = (hz.width - 60) / hotCols;
    const hSpY = (hz.height - 60) / hotRows;

    for (let row = 0; row < hotRows; row++) {
      for (let col = 0; col < hotCols; col++) {
        const hx = hz.x + 30 + col * hSpX + hSpX / 2 - 35;
        const hy = hz.y + 30 + row * hSpY + hSpY / 2 - 16;
        this.drawDesk(g, hx, hy, 70, 28);
        this.drawChair(g, hx + 35, hy + 38);
        this.drawMonitor(g, hx + 35, hy + 5);
      }
    }

    // ══ MEETING ROOM ══
    const mz = ZONES.meeting;
    const mcx = mz.x + mz.width / 2;
    const mcy = mz.y + mz.height / 2;
    const tableRadius = 60;

    // Table shadow
    g.ellipse(mcx + 2, mcy + 3, tableRadius, tableRadius * 0.4);
    g.fill({ color: 0x000000, alpha: 0.15 });

    // Round meeting table
    g.circle(mcx, mcy, tableRadius);
    g.fill(TABLE_COLOR);
    g.stroke({ color: 0x7a7090, width: 2 });

    // Table surface highlight
    g.circle(mcx, mcy, tableRadius - 8);
    g.fill({ color: 0xffffff, alpha: 0.025 });

    // Center emblem (OpenClaw logo placeholder)
    g.circle(mcx, mcy, 18);
    g.fill({ color: ACCENT_PURPLE, alpha: 0.1 });
    g.stroke({ color: ACCENT_PURPLE, width: 1.5, alpha: 0.2 });
    g.circle(mcx, mcy, 8);
    g.fill({ color: ACCENT_PURPLE, alpha: 0.08 });

    // Meeting chairs
    const chairCount = 8;
    const chairRadius = tableRadius + 28;
    for (let i = 0; i < chairCount; i++) {
      const angle = (Math.PI * 2 * i) / chairCount - Math.PI / 2;
      const cx = mcx + Math.cos(angle) * chairRadius;
      const cy = mcy + Math.sin(angle) * chairRadius;
      this.drawChair(g, cx, cy);
    }

    // Whiteboard on wall
    const wbX = mz.x + mz.width - 90;
    const wbY = mz.y + 18;
    this.drawWhiteboard(g, wbX, wbY);

    // ══ LOUNGE ══
    const lz = ZONES.lounge;

    // Sofas (bigger, more prominent)
    this.drawSofa(g, lz.x + 60, lz.y + 45, 120, 45, false);
    this.drawSofa(g, lz.x + 260, lz.y + 45, 120, 45, false);
    this.drawSofa(g, lz.x + 60, lz.y + 140, 120, 45, true);
    this.drawSofa(g, lz.x + 400, lz.y + 70, 45, 90, false);

    // Coffee tables
    this.drawCoffeeTable(g, lz.x + 110, lz.y + 95, 50, 35);
    this.drawCoffeeTable(g, lz.x + 300, lz.y + 95, 50, 35);

    // Coffee cups on tables (cozy detail)
    g.circle(lz.x + 125, lz.y + 105, 4);
    g.fill({ color: 0x8a6a4a, alpha: 0.7 });
    g.circle(lz.x + 125, lz.y + 105, 2.5);
    g.fill({ color: 0xba9a7a, alpha: 0.5 });

    g.circle(lz.x + 315, lz.y + 108, 4);
    g.fill({ color: 0x8a6a4a, alpha: 0.7 });
    g.circle(lz.x + 315, lz.y + 108, 2.5);
    g.fill({ color: 0xba9a7a, alpha: 0.5 });

    // Logo wall
    const logoCX = lz.x + lz.width / 2;
    const logoY = lz.y + lz.height * 0.52;

    // Logo backdrop — dark panel with accent border
    g.roundRect(logoCX - 110, logoY - 2, 220, 40, 6);
    g.fill({ color: 0x1a1a2e, alpha: 0.9 });
    g.stroke({ color: ACCENT_PURPLE, width: 1, alpha: 0.3 });
    // Top accent strip
    g.roundRect(logoCX - 110, logoY - 2, 220, 3, 1.5);
    g.fill({ color: ACCENT_PURPLE, alpha: 0.4 });

    // Reception desk
    const rdY = logoY + 52;
    g.roundRect(logoCX - 85, rdY, 170, 26, 13);
    g.fill(DESK_WOOD);
    g.stroke({ color: DESK_TOP_COLOR, width: 1 });
    g.roundRect(logoCX - 81, rdY + 3, 162, 20, 10);
    g.fill({ color: DESK_TOP_COLOR, alpha: 0.4 });

    // === COFFEE MACHINE ===
    this.drawCoffeeMachine(g, lz.x + 450, lz.y + 30);

    // === WATER COOLER ===
    this.drawWaterCooler(g, lz.x + 450, lz.y + 100);

    // Plants
    this.drawPlant(g, logoCX - 140, logoY + 20);
    this.drawPlant(g, logoCX + 140, logoY + 20);
    this.drawPlant(g, lz.x + 30, lz.y + lz.height - 40);
    this.drawPlant(g, lz.x + lz.width - 30, lz.y + lz.height - 40);

    // Desk zone plants (corners)
    this.drawPlant(g, dz.x + 16, dz.y + 16);
    this.drawPlant(g, dz.x + dz.width - 16, dz.y + 16);
    this.drawPlant(g, dz.x + 16, dz.y + dz.height - 16);

    // Meeting room plant
    this.drawPlant(g, mz.x + 20, mz.y + mz.height - 30);

    // Hot desk plant
    this.drawPlant(g, hz.x + hz.width - 20, hz.y + 20);

    // Water cooler in corridor near lounge
    const cw = OFFICE.corridorWidth;
    const midX = OFFICE.x + (OFFICE.width - cw) / 2;
    const midY = OFFICE.y + (OFFICE.height - cw) / 2;
    this.drawWaterCooler(g, midX + cw / 2, midY + cw + 30);

    this.furnitureLayer.addChild(g);

    // Logo text (separate Text object)
    const logoText = new Text({
      text: "⚡ OpenClaw",
      style: new TextStyle({
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fill: 0xc4b5fd,
        fontWeight: "bold",
        letterSpacing: 2,
      }),
    });
    logoText.anchor.set(0.5, 0.5);
    logoText.x = logoCX;
    logoText.y = logoY + 18;
    this.furnitureLayer.addChild(logoText);
  }

  // ─── DECORATIONS (wall art, clocks, posters) ──────────────

  private buildDecorations(): void {
    const g = new Graphics();
    
    // === WALL DECORATIONS ===
    
    // Desk zone - motivational poster
    const dz = ZONES.desk;
    this.drawPoster(g, dz.x + 20, dz.y + 50, 0x3060a0);
    
    // Wall clock in desk zone
    this.drawClock(g, dz.x + dz.width - 40, dz.y + 30);
    
    // Hot desk zone - picture frames
    const hz = ZONES.hotDesk;
    this.drawPictureFrame(g, hz.x + 30, hz.y + 50, 45, 35, 0x5a4a3a);
    this.drawPictureFrame(g, hz.x + hz.width - 60, hz.y + 45, 50, 40, 0x4a5a6a);
    
    // Meeting room - presentation screen / another whiteboard element
    const mz = ZONES.meeting;
    this.drawPoster(g, mz.x + 25, mz.y + 50, 0x505080);
    
    // Clock in meeting room
    this.drawClock(g, mz.x + mz.width - 30, mz.y + 25);
    
    // Lounge decorations
    const lz = ZONES.lounge;
    this.drawPictureFrame(g, lz.x + 20, lz.y + 30, 60, 45, 0x6a3a5a);
    
    this.decorLayer.addChild(g);
  }

  // ─── CEILING LIGHTS ───────────────────────────────────────

  private buildCeilingLights(): void {
    const lightPositions = [
      // Desk zone
      { x: ZONES.desk.x + ZONES.desk.width * 0.25, y: ZONES.desk.y + ZONES.desk.height * 0.33 },
      { x: ZONES.desk.x + ZONES.desk.width * 0.75, y: ZONES.desk.y + ZONES.desk.height * 0.33 },
      { x: ZONES.desk.x + ZONES.desk.width * 0.5, y: ZONES.desk.y + ZONES.desk.height * 0.66 },
      // Meeting zone
      { x: ZONES.meeting.x + ZONES.meeting.width * 0.5, y: ZONES.meeting.y + ZONES.meeting.height * 0.5 },
      // Hot desk zone
      { x: ZONES.hotDesk.x + ZONES.hotDesk.width * 0.33, y: ZONES.hotDesk.y + ZONES.hotDesk.height * 0.5 },
      { x: ZONES.hotDesk.x + ZONES.hotDesk.width * 0.66, y: ZONES.hotDesk.y + ZONES.hotDesk.height * 0.5 },
      // Lounge
      { x: ZONES.lounge.x + ZONES.lounge.width * 0.3, y: ZONES.lounge.y + ZONES.lounge.height * 0.35 },
      { x: ZONES.lounge.x + ZONES.lounge.width * 0.7, y: ZONES.lounge.y + ZONES.lounge.height * 0.35 },
    ];

    for (const pos of lightPositions) {
      const lightG = new Graphics();
      
      // Outer glow
      lightG.circle(pos.x, pos.y, 30);
      lightG.fill({ color: 0xffd599, alpha: 0.03 });
      
      // Middle glow
      lightG.circle(pos.x, pos.y, 18);
      lightG.fill({ color: 0xffd599, alpha: 0.06 });
      
      // Inner bright
      lightG.circle(pos.x, pos.y, 8);
      lightG.fill({ color: 0xffeedd, alpha: 0.15 });
      
      // Center
      lightG.circle(pos.x, pos.y, 4);
      lightG.fill({ color: 0xffffff, alpha: 0.25 });
      
      this.ceilingLights.push({ x: pos.x, y: pos.y, graphics: lightG });
      this.ambientLayer.addChild(lightG);
      
      // Add to glowing objects for animation
      this.glowingObjects.push({
        graphics: lightG,
        baseAlpha: 1,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.3,
        color: 0xffd599,
      });
    }
  }

  private drawDesk(g: Graphics, x: number, y: number, w: number, h: number): void {
    // Shadow
    g.roundRect(x + 2, y + 3, w, h, 4);
    g.fill({ color: DESK_SHADOW, alpha: 0.3 });
    // Desk body
    g.roundRect(x, y, w, h, 4);
    g.fill(DESK_WOOD);
    g.stroke({ color: DESK_TOP_COLOR, width: 0.8 });
    // Surface highlight
    g.roundRect(x + 3, y + 2, w - 6, h - 4, 3);
    g.fill({ color: DESK_TOP_COLOR, alpha: 0.3 });
    // Front edge accent
    g.roundRect(x + 2, y + h - 3, w - 4, 2, 1);
    g.fill({ color: 0xffffff, alpha: 0.04 });
  }

  private drawMonitor(g: Graphics, cx: number, cy: number): void {
    // Monitor shadow
    g.roundRect(cx - 10, cy + 2, 20, 14, 2);
    g.fill({ color: 0x000000, alpha: 0.2 });
    // Monitor body
    g.roundRect(cx - 9, cy, 18, 12, 2);
    g.fill(0x2a2a3a);
    g.stroke({ color: 0x4a4a5a, width: 0.8 });
    // Screen
    g.roundRect(cx - 7, cy + 1, 14, 9, 1);
    g.fill({ color: SCREEN_FACE, alpha: 0.25 });
    // Screen glow
    g.roundRect(cx - 7, cy + 1, 14, 9, 1);
    g.fill({ color: SCREEN_GLOW, alpha: 0.08 });
    // Stand
    g.rect(cx - 2, cy + 12, 4, 3);
    g.fill(0x3a3a4a);
    // Base
    g.roundRect(cx - 5, cy + 14, 10, 2, 1);
    g.fill(0x3a3a4a);
  }

  private drawChair(g: Graphics, cx: number, cy: number): void {
    // Shadow
    g.circle(cx + 1, cy + 1, 9);
    g.fill({ color: 0x000000, alpha: 0.15 });
    // Chair base
    g.circle(cx, cy, 9);
    g.fill(CHAIR_BASE);
    g.stroke({ color: 0x5a5a6a, width: 0.8 });
    // Cushion
    g.circle(cx, cy, 5);
    g.fill({ color: 0x5a5a6a, alpha: 0.5 });
    // Highlight
    g.circle(cx - 1, cy - 1, 2);
    g.fill({ color: 0xffffff, alpha: 0.05 });
  }

  private drawSofa(g: Graphics, x: number, y: number, w: number, h: number, flipped: boolean): void {
    // Shadow
    g.roundRect(x + 2, y + 3, w, h, 8);
    g.fill({ color: 0x000000, alpha: 0.2 });
    // Body
    g.roundRect(x, y, w, h, 8);
    g.fill(SOFA_PRIMARY);
    g.stroke({ color: 0x7a4a9a, width: 1 });

    // Cushion dividers
    const cushions = Math.max(2, Math.floor(w / 40));
    const cushionW = (w - 10) / cushions;
    for (let i = 1; i < cushions; i++) {
      const lx = x + 5 + i * cushionW;
      g.moveTo(lx, y + 5);
      g.lineTo(lx, y + h - 5);
      g.stroke({ color: SOFA_CUSHION, width: 0.6, alpha: 0.5 });
    }

    // Back rest
    if (!flipped) {
      g.roundRect(x + 3, y, w - 6, 7, 4);
      g.fill({ color: 0x5a2a7a, alpha: 0.5 });
    } else {
      g.roundRect(x + 3, y + h - 7, w - 6, 7, 4);
      g.fill({ color: 0x5a2a7a, alpha: 0.5 });
    }

    // Pillow / cushion highlights
    g.roundRect(x + 8, y + (flipped ? h - 14 : 8), 20, 8, 4);
    g.fill({ color: ACCENT_PURPLE, alpha: 0.1 });
    
    // Throw pillows
    g.roundRect(x + w - 30, y + (flipped ? h - 16 : 10), 16, 10, 3);
    g.fill({ color: 0x80c0a0, alpha: 0.5 });
  }

  private drawCoffeeTable(g: Graphics, x: number, y: number, w: number, h: number): void {
    // Shadow
    g.roundRect(x + 1, y + 2, w, h, 5);
    g.fill({ color: 0x000000, alpha: 0.15 });
    // Table
    g.roundRect(x, y, w, h, 5);
    g.fill({ color: 0x5a3a2a, alpha: 0.8 });
    g.stroke({ color: 0x7a5a3a, width: 1 });
    // Surface highlight
    g.roundRect(x + 3, y + 2, w - 6, h - 4, 3);
    g.fill({ color: 0xffffff, alpha: 0.03 });
  }

  private drawPlant(g: Graphics, cx: number, cy: number): void {
    // Pot shadow
    g.ellipse(cx + 1, cy + 8, 8, 3);
    g.fill({ color: 0x000000, alpha: 0.15 });
    // Pot
    g.roundRect(cx - 7, cy, 14, 12, 3);
    g.fill(PLANT_POT_COLOR);
    g.stroke({ color: 0x8a5a3a, width: 0.5 });
    // Pot rim
    g.roundRect(cx - 8, cy - 1, 16, 4, 2);
    g.fill({ color: 0x7a5a3a, alpha: 0.8 });
    // Leaves
    g.circle(cx, cy - 6, 10);
    g.fill({ color: PLANT_LIGHT, alpha: 0.8 });
    g.circle(cx - 6, cy - 3, 7);
    g.fill({ color: PLANT_DARK, alpha: 0.7 });
    g.circle(cx + 6, cy - 3, 7);
    g.fill({ color: 0x2a7a3a, alpha: 0.7 });
    // Top leaf
    g.circle(cx, cy - 12, 5);
    g.fill({ color: PLANT_LIGHT, alpha: 0.6 });
    // Leaf vein highlights
    g.circle(cx - 2, cy - 8, 2);
    g.fill({ color: 0x4aaa5a, alpha: 0.3 });
  }

  private drawWaterCooler(g: Graphics, cx: number, cy: number): void {
    // Shadow
    g.roundRect(cx - 7, cy + 2, 14, 20, 3);
    g.fill({ color: 0x000000, alpha: 0.15 });
    // Body
    g.roundRect(cx - 6, cy, 12, 18, 3);
    g.fill(0x8a9aaa);
    g.stroke({ color: 0x6a7a8a, width: 0.8 });
    // Water jug
    g.roundRect(cx - 4, cy - 6, 8, 8, 2);
    g.fill({ color: 0x4a8aff, alpha: 0.3 });
    g.stroke({ color: 0x6a9aff, width: 0.5, alpha: 0.5 });
    // Dispenser
    g.circle(cx, cy + 10, 2);
    g.fill({ color: ACCENT_CYAN, alpha: 0.5 });
  }

  private drawCoffeeMachine(g: Graphics, cx: number, cy: number): void {
    // Shadow
    g.roundRect(cx - 12, cy + 2, 24, 30, 3);
    g.fill({ color: 0x000000, alpha: 0.15 });
    // Machine body
    g.roundRect(cx - 10, cy, 20, 28, 3);
    g.fill(0x3a3a3a);
    g.stroke({ color: 0x5a5a5a, width: 0.8 });
    // Top section
    g.roundRect(cx - 8, cy + 2, 16, 8, 2);
    g.fill({ color: 0x2a2a2a, alpha: 0.8 });
    // Water reservoir (visible through panel)
    g.roundRect(cx - 6, cy + 3, 12, 6, 1);
    g.fill({ color: 0x6090c0, alpha: 0.25 });
    // Control buttons
    g.circle(cx - 3, cy + 14, 2);
    g.fill({ color: 0x40c040, alpha: 0.8 });
    g.circle(cx + 3, cy + 14, 2);
    g.fill({ color: 0x606060, alpha: 0.6 });
    // Drip tray
    g.roundRect(cx - 7, cy + 22, 14, 4, 1);
    g.fill({ color: 0x505050, alpha: 0.6 });
    // Cup area
    g.roundRect(cx - 5, cy + 18, 10, 4, 1);
    g.fill({ color: 0x2a2a2a, alpha: 0.4 });
  }

  private drawWhiteboard(g: Graphics, x: number, y: number): void {
    g.roundRect(x, y, 70, 45, 4);
    g.fill({ color: 0x3a3a52, alpha: 0.8 });
    g.stroke({ color: 0x6a6a8a, width: 1 });
    // Whiteboard surface
    g.roundRect(x + 4, y + 4, 62, 37, 2);
    g.fill({ color: 0xf0f0f0, alpha: 0.06 });
    // Scribbles - flowchart elements
    g.roundRect(x + 10, y + 10, 15, 10, 2);
    g.stroke({ color: 0x4080c0, width: 1, alpha: 0.6 });
    g.roundRect(x + 35, y + 10, 18, 10, 2);
    g.stroke({ color: 0x40c080, width: 1, alpha: 0.6 });
    // Arrow
    g.moveTo(x + 26, y + 15);
    g.lineTo(x + 34, y + 15);
    g.stroke({ color: 0x333333, width: 0.8, alpha: 0.5 });
    // Text lines
    g.rect(x + 10, y + 26, 40, 2);
    g.fill({ color: 0x333333, alpha: 0.3 });
    g.rect(x + 10, y + 31, 35, 2);
    g.fill({ color: 0x333333, alpha: 0.25 });
    // Marker tray
    g.roundRect(x + 10, y + 42, 50, 4, 2);
    g.fill({ color: 0x5a5a6a, alpha: 0.5 });
    // Colored markers
    const markerColors = [0xff4444, 0x44ff44, 0x4444ff];
    markerColors.forEach((mc, i) => {
      g.roundRect(x + 15 + i * 14, y + 42, 8, 3, 1);
      g.fill({ color: mc, alpha: 0.6 });
    });
  }

  private drawPoster(g: Graphics, x: number, y: number, color: number): void {
    // Shadow
    g.roundRect(x + 2, y + 2, 40, 55, 3);
    g.fill({ color: 0x000000, alpha: 0.2 });
    // Frame
    g.roundRect(x, y, 40, 55, 3);
    g.fill({ color: 0x3a3a4a, alpha: 0.9 });
    g.stroke({ color: 0x5a5a6a, width: 1 });
    // Poster content
    g.roundRect(x + 3, y + 3, 34, 49, 2);
    g.fill({ color, alpha: 0.4 });
    // Text lines on poster
    g.rect(x + 8, y + 35, 24, 2);
    g.fill({ color: 0xffffff, alpha: 0.15 });
    g.rect(x + 8, y + 40, 20, 2);
    g.fill({ color: 0xffffff, alpha: 0.1 });
  }

  private drawClock(g: Graphics, cx: number, cy: number): void {
    // Shadow
    g.circle(cx + 1, cy + 1, 14);
    g.fill({ color: 0x000000, alpha: 0.15 });
    // Clock body
    g.circle(cx, cy, 14);
    g.fill({ color: 0x2a2a3a, alpha: 0.9 });
    g.stroke({ color: 0x5a5a6a, width: 1 });
    // Clock face
    g.circle(cx, cy, 11);
    g.fill({ color: 0xf0f0f0, alpha: 0.08 });
    // Hour markers
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI * 2) / 12 - Math.PI / 2;
      const mx = cx + Math.cos(angle) * 9;
      const my = cy + Math.sin(angle) * 9;
      g.circle(mx, my, 1);
      g.fill({ color: 0xaaaaaa, alpha: 0.5 });
    }
    // Hour hand
    g.moveTo(cx, cy);
    g.lineTo(cx + 4, cy - 3);
    g.stroke({ color: 0x333333, width: 1.5, alpha: 0.7 });
    // Minute hand
    g.moveTo(cx, cy);
    g.lineTo(cx + 2, cy - 7);
    g.stroke({ color: 0x555555, width: 1, alpha: 0.6 });
    // Center dot
    g.circle(cx, cy, 1.5);
    g.fill({ color: 0xc04040, alpha: 0.8 });
  }

  private drawPictureFrame(g: Graphics, x: number, y: number, w: number, h: number, color: number): void {
    // Shadow
    g.roundRect(x + 2, y + 2, w, h, 2);
    g.fill({ color: 0x000000, alpha: 0.15 });
    // Frame
    g.roundRect(x, y, w, h, 2);
    g.fill({ color: 0x5a4a3a, alpha: 0.9 });
    g.stroke({ color: 0x7a6a5a, width: 1 });
    // Inner mat
    g.roundRect(x + 3, y + 3, w - 6, h - 6, 1);
    g.fill({ color: 0xf0f0e8, alpha: 0.08 });
    // Picture content (abstract)
    g.roundRect(x + 5, y + 5, w - 10, h - 10, 1);
    g.fill({ color, alpha: 0.35 });
    // Some abstract shapes in picture
    g.circle(x + w * 0.3, y + h * 0.4, 6);
    g.fill({ color: 0xffffff, alpha: 0.1 });
    g.circle(x + w * 0.6, y + h * 0.5, 8);
    g.fill({ color: 0xffffff, alpha: 0.08 });
  }

  // ─── LABELS ───────────────────────────────────────────────

  private buildLabels(): void {
    const labelStyle = new TextStyle({
      fontSize: 11,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fill: 0x8a8aaa,
      fontWeight: "bold",
      letterSpacing: 2,
    });

    for (const [_key, zone] of Object.entries(ZONES)) {
      const label = new Text({
        text: zone.label.toUpperCase(),
        style: labelStyle,
      });
      label.anchor.set(0.5, 0);
      label.x = zone.x + zone.width / 2;
      label.y = zone.y + 8;
      label.alpha = 0.45;
      this.labelLayer.addChild(label);
    }
  }

  // ─── GRID ─────────────────────────────────────────────────

  private buildGrid(): void {
    const g = this.gridGraphics;
    const step = TILE_SIZE;

    for (let x = OFFICE.x; x < OFFICE.x + OFFICE.width; x += step) {
      g.moveTo(x, OFFICE.y);
      g.lineTo(x, OFFICE.y + OFFICE.height);
      g.stroke({ color: 0xffffff, width: 0.3, alpha: 0.08 });
    }
    for (let y = OFFICE.y; y < OFFICE.y + OFFICE.height; y += step) {
      g.moveTo(OFFICE.x, y);
      g.lineTo(OFFICE.x + OFFICE.width, y);
      g.stroke({ color: 0xffffff, width: 0.3, alpha: 0.08 });
    }
  }

  // ─── ENTRANCE ─────────────────────────────────────────────

  private buildEntrance(): void {
    const lz = ZONES.lounge;
    const doorCX = lz.x + lz.width / 2;
    const doorY = OFFICE.y + OFFICE.height;
    const doorW = 70;
    const half = doorW / 2;

    const g = new Graphics();

    // Erase wall for door opening
    g.rect(doorCX - half - 2, doorY - OFFICE.wallThickness - 2, doorW + 4, OFFICE.wallThickness + 6);
    g.fill(FLOOR_LOUNGE);

    // Door frame posts
    g.rect(doorCX - half - 3, doorY - 12, 4, 14);
    g.fill(WALL_BORDER);
    g.rect(doorCX + half - 1, doorY - 12, 4, 14);
    g.fill(WALL_BORDER);

    // Welcome mat
    g.roundRect(doorCX - 32, doorY - 20, 64, 14, 4);
    g.fill({ color: 0x4a3a2a, alpha: 0.5 });
    g.stroke({ color: 0x6a5a4a, width: 0.5, alpha: 0.3 });

    this.wallLayer.addChild(g);

    // Entrance label
    const entranceLabel = new Text({
      text: "▼  ENTRANCE  ▼",
      style: new TextStyle({
        fontSize: 8,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fill: 0x6a6a8a,
        fontWeight: "bold",
        letterSpacing: 2,
      }),
    });
    entranceLabel.anchor.set(0.5, 0);
    entranceLabel.x = doorCX;
    entranceLabel.y = doorY + 8;
    this.wallLayer.addChild(entranceLabel);

    // Glowing entrance indicator
    const glowG = new Graphics();
    glowG.rect(doorCX - half, doorY - 2, doorW, 3);
    glowG.fill({ color: ACCENT_CYAN, alpha: 0.25 });
    glowG.rect(doorCX - half + 5, doorY - 1, doorW - 10, 1);
    glowG.fill({ color: ACCENT_CYAN, alpha: 0.15 });
    this.wallLayer.addChild(glowG);
  }

  // ─── AMBIENT LIGHTING ─────────────────────────────────────

  private buildAmbientLighting(): void {
    const g = new Graphics();

    // Warm glow near monitors in desk zone
    const dz = ZONES.desk;
    const deskCols = 3;
    const deskRows = 3;
    const deskPadX = 35;
    const deskPadY = 45;
    const deskSpacingX = (dz.width - deskPadX * 2) / deskCols;
    const deskSpacingY = (dz.height - deskPadY * 2) / deskRows;

    for (let row = 0; row < deskRows; row++) {
      for (let col = 0; col < deskCols; col++) {
        const cx = dz.x + deskPadX + col * deskSpacingX + deskSpacingX / 2;
        const cy = dz.y + deskPadY + row * deskSpacingY + deskSpacingY / 2 - 10;
        g.circle(cx, cy, 25);
        g.fill({ color: SCREEN_GLOW, alpha: 0.015 });
      }
    }

    // Warm glow in lounge area
    const lz = ZONES.lounge;
    g.circle(lz.x + lz.width / 2, lz.y + lz.height * 0.3, 80);
    g.fill({ color: ACCENT_WARM, alpha: 0.01 });

    // Meeting room center glow
    const mz = ZONES.meeting;
    g.circle(mz.x + mz.width / 2, mz.y + mz.height / 2, 50);
    g.fill({ color: ACCENT_PURPLE, alpha: 0.012 });

    this.ambientLayer.addChild(g);
  }

  // ─── PARTICLES ────────────────────────────────────────────

  private initParticles(): void {
    // Ambient dust motes (lounge)
    const lz = ZONES.lounge;
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x: lz.x + Math.random() * lz.width,
        y: lz.y + Math.random() * lz.height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.04 - Math.random() * 0.08,
        alpha: 0.08 + Math.random() * 0.15,
        size: 0.5 + Math.random() * 1.2,
        life: Math.random() * 250,
        maxLife: 250 + Math.random() * 250,
        color: 0xffffff,
      });
    }

    // Screen glow particles (desk zone)
    const dz = ZONES.desk;
    for (let i = 0; i < 12; i++) {
      this.particles.push({
        x: dz.x + 20 + Math.random() * (dz.width - 40),
        y: dz.y + 20 + Math.random() * (dz.height - 40),
        vx: (Math.random() - 0.5) * 0.08,
        vy: -0.06 - Math.random() * 0.08,
        alpha: 0.04 + Math.random() * 0.08,
        size: 0.8 + Math.random() * 1.5,
        life: Math.random() * 300,
        maxLife: 300 + Math.random() * 200,
        color: SCREEN_GLOW,
      });
    }

    // Purple motes (meeting room)
    const mz = ZONES.meeting;
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: mz.x + 30 + Math.random() * (mz.width - 60),
        y: mz.y + 30 + Math.random() * (mz.height - 60),
        vx: (Math.random() - 0.5) * 0.06,
        vy: (Math.random() - 0.5) * 0.06,
        alpha: 0.03 + Math.random() * 0.06,
        size: 0.6 + Math.random() * 1,
        life: Math.random() * 400,
        maxLife: 400 + Math.random() * 200,
        color: ACCENT_PURPLE,
      });
    }
  }

  private initSteamParticles(): void {
    // Coffee machine steam
    const lz = ZONES.lounge;
    const coffeeMachineX = lz.x + 450;
    const coffeeMachineY = lz.y + 30;
    
    for (let i = 0; i < 8; i++) {
      this.steamParticles.push({
        x: coffeeMachineX + (Math.random() - 0.5) * 6,
        y: coffeeMachineY - 5,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -0.3 - Math.random() * 0.2,
        alpha: 0.2 + Math.random() * 0.2,
        size: 1.5 + Math.random() * 1.5,
        life: Math.random() * 60,
      });
    }
  }

  public toggleGrid(): void {
    this._showGrid = !this._showGrid;
    this.gridLayer.visible = this._showGrid;
  }

  // ─── TICK (ANIMATION) ─────────────────────────────────────

  public tick(dt: number): void {
    this.particleGraphics.clear();
    this.steamGraphics.clear();
    this.ambientPhase += 0.01 * dt;

    // Ambient particles
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life += dt;

      // Zone containment
      let zoneMatch = false;
      for (const [, zone] of Object.entries(ZONES)) {
        if (p.x >= zone.x && p.x <= zone.x + zone.width &&
            p.y >= zone.y && p.y <= zone.y + zone.height) {
          zoneMatch = true;
          if (p.life > p.maxLife) {
            p.x = zone.x + 20 + Math.random() * (zone.width - 40);
            p.y = zone.y + zone.height - 10;
            p.life = 0;
          }
          break;
        }
      }

      if (!zoneMatch || p.life > p.maxLife) {
        // Reset to a random zone
        const zones = Object.values(ZONES);
        const z = zones[Math.floor(Math.random() * zones.length)];
        p.x = z.x + 20 + Math.random() * (z.width - 40);
        p.y = z.y + z.height - 10;
        p.life = 0;
      }

      const fadeIn = Math.min(p.life / 40, 1);
      const fadeOut = Math.max(0, 1 - (p.life - p.maxLife + 40) / 40);
      const alpha = p.alpha * fadeIn * fadeOut;

      this.particleGraphics.circle(p.x, p.y, p.size);
      this.particleGraphics.fill({ color: p.color, alpha });
    }

    // Steam particles
    const lz = ZONES.lounge;
    const coffeeMachineX = lz.x + 450;
    const coffeeMachineY = lz.y + 30;
    
    for (const sp of this.steamParticles) {
      sp.x += sp.vx * dt + Math.sin(this.ambientPhase * 3 + sp.life * 0.1) * 0.1;
      sp.y += sp.vy * dt;
      sp.life += dt;
      sp.alpha -= 0.003 * dt;
      sp.size += 0.02 * dt;
      
      // Reset steam when faded or too high
      if (sp.alpha <= 0 || sp.y < coffeeMachineY - 30) {
        sp.x = coffeeMachineX + (Math.random() - 0.5) * 6;
        sp.y = coffeeMachineY - 5;
        sp.vx = (Math.random() - 0.5) * 0.15;
        sp.vy = -0.3 - Math.random() * 0.2;
        sp.alpha = 0.2 + Math.random() * 0.2;
        sp.size = 1.5 + Math.random() * 1.5;
        sp.life = 0;
      }
      
      this.steamGraphics.circle(sp.x, sp.y, sp.size);
      this.steamGraphics.fill({ color: 0xffffff, alpha: Math.max(0, sp.alpha) });
    }

    // Glowing objects pulse
    for (const glow of this.glowingObjects) {
      glow.phase += glow.speed * 0.016 * dt;
      const pulse = glow.baseAlpha * (0.8 + 0.2 * Math.sin(glow.phase));
      glow.graphics.alpha = pulse;
    }

    // Subtle ambient glow pulse
    if (this.ambientGraphics) {
      const pulse = 0.3 + 0.15 * Math.sin(this.ambientPhase);
      this.ambientGraphics.alpha = pulse;
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
