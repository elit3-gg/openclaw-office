import type { AgentVisualStatus } from "@/gateway/types";
import i18n from "@/i18n";

export const SVG_WIDTH = 1600;
export const SVG_HEIGHT = 900;

// Unified office floor plan: one building shell with internal partitions
export const OFFICE = {
  x: 40,
  y: 30,
  width: SVG_WIDTH - 80,
  height: SVG_HEIGHT - 60,
  wallThickness: 6,
  cornerRadius: 18,
  corridorWidth: 40,
} as const;

const halfW = (OFFICE.width - OFFICE.corridorWidth) / 2;
const halfH = (OFFICE.height - OFFICE.corridorWidth) / 2;
const rightX = OFFICE.x + halfW + OFFICE.corridorWidth;
const bottomY = OFFICE.y + halfH + OFFICE.corridorWidth;

export const ZONES = {
  desk: { x: OFFICE.x, y: OFFICE.y, width: halfW, height: halfH, label: "Workstations" },
  meeting: { x: rightX, y: OFFICE.y, width: halfW, height: halfH, label: "Meeting Room" },
  hotDesk: { x: OFFICE.x, y: bottomY, width: halfW, height: halfH, label: "Hot Desks" },
  lounge: { x: rightX, y: bottomY, width: halfW, height: halfH, label: "Lounge" },
} as const;

// Corridor entrance point: bottom center of the building (main entrance door)
export const CORRIDOR_ENTRANCE = {
  x: ZONES.lounge.x + ZONES.lounge.width / 2,
  y: OFFICE.y + OFFICE.height - 30,
} as const;

// Corridor center crossing point
export const CORRIDOR_CENTER = {
  x: OFFICE.x + OFFICE.width / 2,
  y: OFFICE.y + OFFICE.height / 2,
} as const;

export const ZONE_COLORS = {
  desk: "#f4f6f9",
  meeting: "#eef3fa",
  hotDesk: "#f1f3f7",
  lounge: "#f3f1f7",
  corridor: "#e8ecf1",
  wall: "#8b9bb0",
} as const;

export const ZONE_COLORS_DARK = {
  desk: "#2a2a42",
  meeting: "#2e2844",
  hotDesk: "#2a2d40",
  lounge: "#332844",
  corridor: "#252540",
  wall: "#4a4a6a",
} as const;

export const STATUS_COLORS: Record<AgentVisualStatus, string> = {
  idle: "#22c55e",
  thinking: "#3b82f6",
  tool_calling: "#f97316",
  speaking: "#a855f7",
  spawning: "#06b6d4",
  error: "#ef4444",
  offline: "#6b7280",
};

export const STATUS_LABELS: Record<AgentVisualStatus, string> = {
  idle: "Idle",
  thinking: "Thinking",
  tool_calling: "Using Tool",
  speaking: "Responding",
  spawning: "Spawning",
  error: "Error",
  offline: "Offline",
};

export function getZoneLabel(zone: keyof typeof ZONES): string {
  return i18n.t(`common:zones.${zone}`);
}

export function getStatusLabel(status: AgentVisualStatus): string {
  return i18n.t(`common:agent.statusLabels.${status}`);
}

export const DESK_GRID_COLS = 4;
export const DESK_GRID_ROWS = 3;
export const DESK_MAX_AGENTS = DESK_GRID_COLS * DESK_GRID_ROWS;

export const HOT_DESK_GRID_COLS = 4;
export const HOT_DESK_GRID_ROWS = 3;

export const MIN_DESK_WIDTH = 100;
export const DEFAULT_MAX_SUB_AGENTS = 8;

// Furniture size constants (flat isometric 2D)
export const FURNITURE = {
  desk: { width: 100, height: 60 },
  chair: { size: 30 },
  meetingTable: { minRadius: 70, maxRadius: 110 },
  sofa: { width: 130, height: 55 },
  plant: { width: 28, height: 36 },
  coffeeCup: { size: 14 },
} as const;

// Desk unit (Desk + Chair + AgentAvatar)
export const DESK_UNIT = {
  width: 180,
  height: 140,
  avatarRadius: 36,
  avatarOffsetY: -8,
} as const;

// Agent avatar
export const AVATAR = {
  radius: 36,
  selectedRadius: 40,
  strokeWidth: 3,
  nameLabelMaxChars: 12,
} as const;

// 3D scene constants
// SVG 1600×900 maps to 3D building 16×12 world units
export const SCALE_X_2D_TO_3D = 16 / SVG_WIDTH;
export const SCALE_Z_2D_TO_3D = 12 / SVG_HEIGHT;
export const SCALE_2D_TO_3D = 0.01; // legacy — kept for tests
export const DESK_HEIGHT = 0.48;
export const CHARACTER_Y = 0;
export const MEETING_TABLE_RADIUS = 1.4;
export const MEETING_SEAT_RADIUS = 2.1;
