import {
  Assets,
  Container,
  Sprite,
  Texture,
  Rectangle,
  Text,
  TextStyle,
  Graphics,
} from "pixi.js";
import { STATUS_COLORS } from "@/lib/constants";
import type { VisualAgent } from "@/gateway/types";
import {
  createIdleBehaviorState,
  tickIdleBehavior,
  getIdleFacingDirection,
  type IdleBehaviorState,
} from "@/lib/idle-behaviors";
import { getSpritePathForAgent } from "@/lib/agent-sprites";

const FRAME_SIZE = 48;
const SHEET_COLS = 4;
const ANIM_SPEED = 0.1;
const LERP_SPEED = 0.08;

// Direction rows in spritesheet
const DIR_DOWN = 0;
const DIR_LEFT = 1;
const DIR_RIGHT = 2;
const DIR_UP = 3;

export class PixiAgent {
  public readonly container: Container;
  public readonly id: string;

  private sprite: Sprite;
  private nameLabel: Text;
  private statusDot: Graphics;
  private subAgentBadge: Container | null = null;
  private selectionGlow: Graphics;
  private speechContainer: Container | null = null;
  private thinkingDots: Container | null = null;
  private toolLabel: Text | null = null;

  // Animation state
  private frames: Texture[] = []; // all 16 frames
  private currentDir: number = DIR_DOWN;
  private animFrame: number = 1; // idle frame
  private animTimer: number = 0;
  private isWalking: boolean = false;

  // Position interpolation
  private targetX: number = 0;
  private targetY: number = 0;
  private currentX: number = 0;
  private currentY: number = 0;

  // State
  private _selected: boolean = false;
  private _speechText: string | null = null;

  // Particle timer for thinking
  private thinkTimer: number = 0;

  // Glow pulse
  private glowPhase: number = Math.random() * Math.PI * 2;

  private textureLoaded: boolean = false;

  // Idle behavior system
  private idleBehavior: IdleBehaviorState = createIdleBehaviorState();
  private lastStatus: string = "idle";

  constructor(agent: VisualAgent) {
    this.id = agent.id;
    this.container = new Container();
    this.container.sortableChildren = true;

    // Selection glow (drawn below everything)
    this.selectionGlow = new Graphics();
    this.selectionGlow.zIndex = 0;
    this.container.addChild(this.selectionGlow);

    // Status glow circle under agent
    const statusGlow = new Graphics();
    statusGlow.zIndex = 1;
    statusGlow.label = "statusGlow";
    this.container.addChild(statusGlow);

    // Sprite
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5, 1.0);
    this.sprite.zIndex = 2;
    this.sprite.width = FRAME_SIZE;
    this.sprite.height = FRAME_SIZE;
    this.container.addChild(this.sprite);

    // Name label
    this.nameLabel = new Text({
      text: this.truncateName(agent.name),
      style: new TextStyle({
        fontFamily: "monospace",
        fontSize: 10,
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 3 },
        align: "center",
      }),
    });
    this.nameLabel.anchor.set(0.5, 0);
    this.nameLabel.y = 4;
    this.nameLabel.zIndex = 5;
    this.container.addChild(this.nameLabel);

    // Status dot
    this.statusDot = new Graphics();
    this.statusDot.zIndex = 6;
    this.container.addChild(this.statusDot);

    // Set initial position
    this.targetX = agent.position.x;
    this.targetY = agent.position.y;
    this.currentX = agent.position.x;
    this.currentY = agent.position.y;
    this.container.x = this.currentX;
    this.container.y = this.currentY;

    // Load texture
    this.loadSpriteSheet(agent.id);

    // Apply initial state
    this.updateFromAgent(agent);
  }

  private truncateName(name: string): string {
    if (name.length > 12) return name.slice(0, 11) + "\u2026";
    return name;
  }

  private async loadSpriteSheet(agentId: string) {
    const path = getSpritePathForAgent(agentId);

    try {
      // PixiJS v8: use Assets.load() to properly load and cache textures
      const loadedTexture = await Assets.load<Texture>(path);
      const baseTexture = loadedTexture.source;
      // Extract individual frames from the sprite sheet
      this.frames = [];
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < SHEET_COLS; col++) {
          const frame = new Rectangle(
            col * FRAME_SIZE,
            row * FRAME_SIZE,
            FRAME_SIZE,
            FRAME_SIZE,
          );
          const tex = new Texture({ source: baseTexture, frame });
          this.frames.push(tex);
        }
      }
      // Set idle frame (frame 1 of DIR_DOWN)
      this.sprite.texture = this.frames[DIR_DOWN * SHEET_COLS + 1];
      // Scale up sprite for better visibility (48px sprites → 64px display)
      this.sprite.width = FRAME_SIZE * 1.5;
      this.sprite.height = FRAME_SIZE * 1.5;
      this.textureLoaded = true;
    } catch {
      // Fallback: create a colored rectangle placeholder
      this.createFallbackTexture(agentId);
    }
  }

  private createFallbackTexture(_agentId: string) {
    const g = new Graphics();
    const hue = 200;
    const color = this.hslToHex(hue, 70, 60);
    g.roundRect(-16, -40, 32, 40, 6);
    g.fill(color);
    g.circle(0, -28, 10);
    g.fill(0xffeedd);

    // Note: generateTexture requires an Application renderer reference;
    // Ticker.shared does not expose one in Pixi.js v8.
    this.textureLoaded = true;
  }

  private hslToHex(h: number, s: number, l: number): number {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * c);
    };
    return (f(0) << 16) | (f(8) << 8) | f(4);
  }

  public updateFromAgent(agent: VisualAgent): void {
    // Update target position
    this.targetX = agent.position.x;
    this.targetY = agent.position.y;

    // Name
    this.nameLabel.text = this.truncateName(agent.name);

    // Status
    this.lastStatus = agent.status;
    this.updateStatusDot(agent.status);

    // Sub-agent badge
    if (agent.isSubAgent && !this.subAgentBadge) {
      this.createSubAgentBadge();
    } else if (!agent.isSubAgent && this.subAgentBadge) {
      this.container.removeChild(this.subAgentBadge);
      this.subAgentBadge = null;
    }

    // Speech bubble
    const newSpeech = agent.speechBubble?.text ?? null;
    if (newSpeech !== this._speechText) {
      this._speechText = newSpeech;
      this.updateSpeechBubble(newSpeech);
    }

    // Thinking dots
    if (agent.status === "thinking" && !this.thinkingDots) {
      this.createThinkingDots();
    } else if (agent.status !== "thinking" && this.thinkingDots) {
      this.container.removeChild(this.thinkingDots);
      this.thinkingDots = null;
    }

    // Tool label
    if (agent.status === "tool_calling" && agent.currentTool) {
      this.updateToolLabel(agent.currentTool.name);
    } else if (this.toolLabel) {
      this.container.removeChild(this.toolLabel);
      this.toolLabel = null;
    }

    // Error tint
    if (agent.status === "error") {
      this.sprite.tint = 0xff6666;
    } else if (agent.status === "offline") {
      this.sprite.tint = 0x888888;
      this.sprite.alpha = 0.5;
    } else {
      this.sprite.tint = 0xffffff;
      this.sprite.alpha = agent.confirmed ? 1.0 : 0.4;
    }

    // Walking detection
    this.isWalking = agent.movement !== null;

    // Status glow
    this.updateStatusGlow(agent.status);
  }

  private updateStatusDot(status: string): void {
    const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? "#6b7280";
    const hex = parseInt(color.replace("#", ""), 16);

    this.statusDot.clear();
    // Outer glow
    this.statusDot.circle(0, -FRAME_SIZE - 8, 5);
    this.statusDot.fill({ color: hex, alpha: 0.3 });
    // Inner dot
    this.statusDot.circle(0, -FRAME_SIZE - 8, 3);
    this.statusDot.fill(hex);
  }

  private updateStatusGlow(status: string): void {
    const glowChild = this.container.children.find(
      (c) => c.label === "statusGlow",
    ) as Graphics | undefined;
    if (!glowChild) return;

    const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? "#6b7280";
    const hex = parseInt(color.replace("#", ""), 16);

    glowChild.clear();
    glowChild.ellipse(0, 0, 20, 8);
    glowChild.fill({ color: hex, alpha: 0.2 });
  }

  private createSubAgentBadge(): void {
    this.subAgentBadge = new Container();
    this.subAgentBadge.zIndex = 7;

    const bg = new Graphics();
    bg.circle(0, 0, 8);
    bg.fill(0x06b6d4);
    bg.stroke({ color: 0xffffff, width: 1.5 });
    this.subAgentBadge.addChild(bg);

    const text = new Text({
      text: "S",
      style: new TextStyle({
        fontSize: 9,
        fontFamily: "monospace",
        fill: 0xffffff,
        fontWeight: "bold",
      }),
    });
    text.anchor.set(0.5, 0.5);
    this.subAgentBadge.addChild(text);

    this.subAgentBadge.x = 18;
    this.subAgentBadge.y = -FRAME_SIZE - 4;
    this.container.addChild(this.subAgentBadge);
  }

  private updateSpeechBubble(text: string | null): void {
    if (this.speechContainer) {
      this.container.removeChild(this.speechContainer);
      this.speechContainer = null;
    }

    if (!text) return;

    this.speechContainer = new Container();
    this.speechContainer.zIndex = 10;

    const maxWidth = 160;
    const padding = 8;

    const label = new Text({
      text: text.length > 80 ? text.slice(0, 77) + "..." : text,
      style: new TextStyle({
        fontSize: 10,
        fontFamily: "monospace",
        fill: 0xffffff,
        wordWrap: true,
        wordWrapWidth: maxWidth - padding * 2,
      }),
    });

    const bubbleW = Math.min(label.width + padding * 2, maxWidth);
    const bubbleH = label.height + padding * 2;

    const bg = new Graphics();
    // Bubble body
    bg.roundRect(-bubbleW / 2, -bubbleH, bubbleW, bubbleH, 6);
    bg.fill({ color: 0x1e293b, alpha: 0.9 });
    bg.stroke({ color: 0xa855f7, width: 1 });
    // Pointer triangle
    bg.moveTo(-5, 0);
    bg.lineTo(0, 8);
    bg.lineTo(5, 0);
    bg.fill({ color: 0x1e293b, alpha: 0.9 });

    this.speechContainer.addChild(bg);

    label.anchor.set(0.5, 0);
    label.y = -bubbleH + padding;
    this.speechContainer.addChild(label);

    this.speechContainer.y = -FRAME_SIZE - 16;
    this.container.addChild(this.speechContainer);
  }

  private createThinkingDots(): void {
    this.thinkingDots = new Container();
    this.thinkingDots.zIndex = 9;
    this.thinkingDots.y = -FRAME_SIZE - 18;

    for (let i = 0; i < 3; i++) {
      const dot = new Graphics();
      dot.circle(0, 0, 3);
      dot.fill(0x3b82f6);
      dot.x = (i - 1) * 10;
      dot.label = `thinkDot${i}`;
      this.thinkingDots.addChild(dot);
    }

    this.container.addChild(this.thinkingDots);
  }

  private updateToolLabel(toolName: string): void {
    if (this.toolLabel) {
      this.toolLabel.text = toolName.length > 16 ? toolName.slice(0, 14) + ".." : toolName;
      return;
    }

    this.toolLabel = new Text({
      text: toolName.length > 16 ? toolName.slice(0, 14) + ".." : toolName,
      style: new TextStyle({
        fontSize: 8,
        fontFamily: "monospace",
        fill: 0xf97316,
        stroke: { color: 0x000000, width: 2 },
      }),
    });
    this.toolLabel.anchor.set(0.5, 1);
    this.toolLabel.y = -FRAME_SIZE - 14;
    this.toolLabel.zIndex = 8;
    this.container.addChild(this.toolLabel);
  }

  public setSelected(selected: boolean): void {
    this._selected = selected;
    this.drawSelectionGlow();
  }

  private drawSelectionGlow(): void {
    this.selectionGlow.clear();
    if (!this._selected) return;

    // Pulsing glow ring
    const alpha = 0.3 + 0.15 * Math.sin(this.glowPhase);
    this.selectionGlow.ellipse(0, 0, 26, 10);
    this.selectionGlow.fill({ color: 0x60a5fa, alpha });
    this.selectionGlow.ellipse(0, 0, 22, 8);
    this.selectionGlow.stroke({ color: 0x60a5fa, width: 2, alpha: 0.7 });
  }

  public tick(dt: number): void {
    // Position interpolation
    const dx = this.targetX - this.currentX;
    const dy = this.targetY - this.currentY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.5) {
      this.currentX += dx * LERP_SPEED * Math.min(dt, 3);
      this.currentY += dy * LERP_SPEED * Math.min(dt, 3);

      // Determine walk direction
      if (Math.abs(dx) > Math.abs(dy)) {
        this.currentDir = dx > 0 ? DIR_RIGHT : DIR_LEFT;
      } else {
        this.currentDir = dy > 0 ? DIR_DOWN : DIR_UP;
      }
      this.isWalking = true;
    } else {
      this.currentX = this.targetX;
      this.currentY = this.targetY;
      if (!this.isWalking) {
        // Stay idle direction
      }
    }

    // Idle behavior micro-offsets (only when not walking)
    const isActive = this.lastStatus === "thinking" || this.lastStatus === "speaking" || this.lastStatus === "tool_calling" || this.lastStatus === "spawning";
    tickIdleBehavior(this.idleBehavior, dt * 0.016, isActive);

    if (!this.isWalking || dist <= 1) {
      this.container.x = this.currentX + this.idleBehavior.offsetX;
      this.container.y = this.currentY + this.idleBehavior.offsetY;
    } else {
      this.container.x = this.currentX;
      this.container.y = this.currentY;
    }

    // Sprite animation
    if (this.textureLoaded && this.frames.length === 16) {
      if (this.isWalking && dist > 1) {
        this.animTimer += ANIM_SPEED * dt;
        if (this.animTimer >= 1) {
          this.animTimer = 0;
          this.animFrame = (this.animFrame + 1) % SHEET_COLS;
        }
        const frameIdx = this.currentDir * SHEET_COLS + this.animFrame;
        if (this.frames[frameIdx]) {
          this.sprite.texture = this.frames[frameIdx];
        }
      } else {
        // Idle: use facing direction from idle behavior if available
        const idleFacing = getIdleFacingDirection(this.idleBehavior);
        const idleDir = idleFacing !== null ? idleFacing : this.currentDir;
        // Use frame 0 for idle (standing still)
        const frameIdx = idleDir * SHEET_COLS + 1;
        if (this.frames[frameIdx]) {
          this.sprite.texture = this.frames[frameIdx];
        }
        this.animFrame = 1;
        this.animTimer = 0;
      }
    }

    // Thinking dots bounce
    if (this.thinkingDots) {
      this.thinkTimer += 0.05 * dt;
      for (let i = 0; i < 3; i++) {
        const dot = this.thinkingDots.children[i];
        if (dot) {
          dot.y = Math.sin(this.thinkTimer + i * 1.2) * 4;
        }
      }
    }

    // Selection glow pulse
    if (this._selected) {
      this.glowPhase += 0.04 * dt;
      this.drawSelectionGlow();
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }

  public getBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.currentX - 24,
      y: this.currentY - FRAME_SIZE - 10,
      width: 48,
      height: FRAME_SIZE + 20,
    };
  }

  /** Jump position immediately (no lerp) */
  public teleport(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
    this.currentX = x;
    this.currentY = y;
    this.container.x = x;
    this.container.y = y;
  }
}
