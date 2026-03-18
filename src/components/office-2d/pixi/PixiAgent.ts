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
// constants import kept for potential future use
import type { VisualAgent } from "@/gateway/types";
import {
  createIdleBehaviorState,
  tickIdleBehavior,
  getIdleFacingDirection,
  type IdleBehaviorState,
} from "@/lib/idle-behaviors";
import { getSpritePathForAgent } from "@/lib/agent-sprites";
import { getActivityState } from "@/hooks/useCasualRoaming";
import { getAgentFacingTarget } from "@/lib/office-activities";

// ═══════════════════════════════════════════════════════════
// Gather.town-style agent character
// Bigger sprites, drop shadows, floating name plates, warm glow
// ═══════════════════════════════════════════════════════════

const FRAME_SIZE = 48;
const SHEET_COLS = 4;
const ANIM_SPEED = 0.1;
const LERP_SPEED = 0.08;

// Display scale — 2.2x makes characters prominent like Gather.town
const DISPLAY_SCALE = 2.2;
const DISPLAY_SIZE = FRAME_SIZE * DISPLAY_SCALE;

// Direction rows in spritesheet
const DIR_DOWN = 0;
const DIR_LEFT = 1;
const DIR_RIGHT = 2;
const DIR_UP = 3;

// Status color palette
const STATUS_HEX: Record<string, number> = {
  idle: 0x22c55e,
  thinking: 0x3b82f6,
  tool_calling: 0xf97316,
  speaking: 0xa855f7,
  spawning: 0x06b6d4,
  error: 0xef4444,
  offline: 0x6b7280,
};

export class PixiAgent {
  public readonly container: Container;
  public readonly id: string;

  private sprite: Sprite;
  private shadow: Graphics;
  private nameLabel: Text;
  private nameBg: Graphics;
  private statusDot: Graphics;
  private subAgentBadge: Container | null = null;
  private selectionGlow: Graphics;
  private speechContainer: Container | null = null;
  private thinkingDots: Container | null = null;
  private toolLabel: Text | null = null;
  private statusRing: Graphics;

  // Animation state
  private frames: Texture[] = [];
  private currentDir: number = DIR_DOWN;
  private animFrame: number = 1;
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

  // Thinking timer
  private thinkTimer: number = 0;

  // Glow pulse
  private glowPhase: number = Math.random() * Math.PI * 2;

  private textureLoaded: boolean = false;

  // Idle behavior
  private idleBehavior: IdleBehaviorState = createIdleBehaviorState();
  private lastStatus: string = "idle";

  // Walk bob
  private walkBobPhase: number = 0;

  // Activity facing target position (set externally by PixiFloorPlan)
  private _facingTargetPos: { x: number; y: number } | null = null;

  constructor(agent: VisualAgent) {
    this.id = agent.id;
    this.container = new Container();
    this.container.sortableChildren = true;

    // Selection glow (below everything)
    this.selectionGlow = new Graphics();
    this.selectionGlow.zIndex = 0;
    this.container.addChild(this.selectionGlow);

    // Drop shadow (oval under character)
    this.shadow = new Graphics();
    this.shadow.zIndex = 1;
    this.shadow.ellipse(0, 0, 16, 6);
    this.shadow.fill({ color: 0x000000, alpha: 0.25 });
    this.container.addChild(this.shadow);

    // Status ring / glow under character
    this.statusRing = new Graphics();
    this.statusRing.zIndex = 2;
    this.container.addChild(this.statusRing);

    // Sprite
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5, 1.0);
    this.sprite.zIndex = 3;
    this.sprite.width = DISPLAY_SIZE;
    this.sprite.height = DISPLAY_SIZE;
    this.container.addChild(this.sprite);

    // Name background plate
    this.nameBg = new Graphics();
    this.nameBg.zIndex = 4;
    this.container.addChild(this.nameBg);

    // Name label
    this.nameLabel = new Text({
      text: this.truncateName(agent.name),
      style: new TextStyle({
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 10,
        fill: 0xffffff,
        fontWeight: "600",
      }),
    });
    this.nameLabel.anchor.set(0.5, 0);
    this.nameLabel.y = 6;
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
      const loadedTexture = await Assets.load<Texture>(path);
      const baseTexture = loadedTexture.source;

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

      // Set idle frame
      this.sprite.texture = this.frames[DIR_DOWN * SHEET_COLS + 1];
      this.sprite.width = DISPLAY_SIZE;
      this.sprite.height = DISPLAY_SIZE;
      this.textureLoaded = true;
    } catch {
      this.createFallbackSprite();
    }
  }

  private createFallbackSprite(): void {
    // Draw a simple character as fallback
    const fallback = new Graphics();
    // Body
    fallback.roundRect(-12, -44, 24, 32, 6);
    fallback.fill(0x6a6aaa);
    // Head
    fallback.circle(0, -48, 10);
    fallback.fill(0xffeedd);

    this.textureLoaded = true;
  }

  public updateFromAgent(agent: VisualAgent): void {
    this.targetX = agent.position.x;
    this.targetY = agent.position.y;

    // Name
    this.nameLabel.text = this.truncateName(agent.name);
    this.updateNameBackground();

    // Status
    this.lastStatus = agent.status;
    this.updateStatusDot(agent.status);
    this.updateStatusRing(agent.status);

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

    // Visual states
    if (agent.status === "error") {
      this.sprite.tint = 0xff8888;
    } else if (agent.status === "offline") {
      this.sprite.tint = 0x888888;
      this.sprite.alpha = 0.45;
    } else {
      this.sprite.tint = 0xffffff;
      this.sprite.alpha = agent.confirmed ? 1.0 : 0.35;
    }

    this.isWalking = agent.movement !== null;
  }

  private updateNameBackground(): void {
    this.nameBg.clear();
    const w = this.nameLabel.width + 14;
    const h = 16;
    this.nameBg.roundRect(-w / 2, 4, w, h, 6);
    this.nameBg.fill({ color: 0x1a1a2e, alpha: 0.85 });
    this.nameBg.stroke({ color: 0x3a3a5a, width: 0.5, alpha: 0.6 });
  }

  private updateStatusDot(status: string): void {
    const hex = STATUS_HEX[status] ?? 0x6b7280;

    this.statusDot.clear();
    // Glow
    this.statusDot.circle(0, -DISPLAY_SIZE - 6, 6);
    this.statusDot.fill({ color: hex, alpha: 0.25 });
    // Dot
    this.statusDot.circle(0, -DISPLAY_SIZE - 6, 3.5);
    this.statusDot.fill(hex);
    // Bright center
    this.statusDot.circle(0, -DISPLAY_SIZE - 6, 1.5);
    this.statusDot.fill({ color: 0xffffff, alpha: 0.4 });
  }

  private updateStatusRing(status: string): void {
    const hex = STATUS_HEX[status] ?? 0x6b7280;

    this.statusRing.clear();
    // Glow ellipse under the character
    this.statusRing.ellipse(0, 0, 22, 8);
    this.statusRing.fill({ color: hex, alpha: 0.15 });
    // Inner ring
    this.statusRing.ellipse(0, 0, 18, 6);
    this.statusRing.stroke({ color: hex, width: 1, alpha: 0.3 });
  }

  private createSubAgentBadge(): void {
    this.subAgentBadge = new Container();
    this.subAgentBadge.zIndex = 7;

    const bg = new Graphics();
    bg.circle(0, 0, 9);
    bg.fill(0x06b6d4);
    bg.stroke({ color: 0x1a1a2e, width: 2 });
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

    this.subAgentBadge.x = 20;
    this.subAgentBadge.y = -DISPLAY_SIZE - 2;
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

    const maxWidth = 180;
    const padding = 10;

    const label = new Text({
      text: text.length > 100 ? text.slice(0, 97) + "..." : text,
      style: new TextStyle({
        fontSize: 10,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fill: 0xffffff,
        wordWrap: true,
        wordWrapWidth: maxWidth - padding * 2,
      }),
    });

    const bubbleW = Math.min(label.width + padding * 2, maxWidth);
    const bubbleH = label.height + padding * 2;

    const bg = new Graphics();
    // Shadow
    bg.roundRect(-bubbleW / 2 + 2, -bubbleH + 2, bubbleW, bubbleH, 8);
    bg.fill({ color: 0x000000, alpha: 0.2 });
    // Bubble
    bg.roundRect(-bubbleW / 2, -bubbleH, bubbleW, bubbleH, 8);
    bg.fill({ color: 0x1e1e3a, alpha: 0.95 });
    bg.stroke({ color: 0xa855f7, width: 1.5, alpha: 0.6 });
    // Pointer
    bg.moveTo(-6, 0);
    bg.lineTo(0, 10);
    bg.lineTo(6, 0);
    bg.fill({ color: 0x1e1e3a, alpha: 0.95 });

    this.speechContainer.addChild(bg);

    label.anchor.set(0.5, 0);
    label.y = -bubbleH + padding;
    this.speechContainer.addChild(label);

    this.speechContainer.y = -DISPLAY_SIZE - 20;
    this.container.addChild(this.speechContainer);
  }

  private createThinkingDots(): void {
    this.thinkingDots = new Container();
    this.thinkingDots.zIndex = 9;
    this.thinkingDots.y = -DISPLAY_SIZE - 22;

    // Thought bubble background
    const bg = new Graphics();
    bg.roundRect(-18, -8, 36, 16, 8);
    bg.fill({ color: 0x1e1e3a, alpha: 0.85 });
    bg.stroke({ color: 0x3b82f6, width: 1, alpha: 0.4 });
    this.thinkingDots.addChild(bg);

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
    const displayName = toolName.length > 18 ? toolName.slice(0, 16) + ".." : toolName;

    if (this.toolLabel) {
      this.toolLabel.text = displayName;
      return;
    }

    this.toolLabel = new Text({
      text: displayName,
      style: new TextStyle({
        fontSize: 9,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fill: 0xffffff,
        stroke: { color: 0xf97316, width: 3 },
      }),
    });
    this.toolLabel.anchor.set(0.5, 1);
    this.toolLabel.y = -DISPLAY_SIZE - 14;
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

    const alpha = 0.25 + 0.12 * Math.sin(this.glowPhase);
    // Outer glow
    this.selectionGlow.ellipse(0, 0, 30, 12);
    this.selectionGlow.fill({ color: 0x60a5fa, alpha: alpha * 0.6 });
    // Ring
    this.selectionGlow.ellipse(0, 0, 26, 10);
    this.selectionGlow.stroke({ color: 0x60a5fa, width: 2, alpha: 0.6 });
    // Inner bright ring
    this.selectionGlow.ellipse(0, 0, 22, 8);
    this.selectionGlow.stroke({ color: 0x93c5fd, width: 1, alpha: 0.4 });
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
    }

    // Idle behavior micro-offsets
    const isActive = this.lastStatus === "thinking" || this.lastStatus === "speaking" ||
                     this.lastStatus === "tool_calling" || this.lastStatus === "spawning";
    tickIdleBehavior(this.idleBehavior, dt * 0.016, isActive);

    // Walk bob animation
    let bobY = 0;
    if (this.isWalking && dist > 1) {
      this.walkBobPhase += 0.15 * dt;
      bobY = Math.sin(this.walkBobPhase * Math.PI * 2) * 2;
    } else {
      this.walkBobPhase = 0;
      // Subtle idle breathing
      bobY = Math.sin(this.glowPhase * 0.5) * 0.5;
    }

    if (!this.isWalking || dist <= 1) {
      this.container.x = this.currentX + this.idleBehavior.offsetX;
      this.container.y = this.currentY + this.idleBehavior.offsetY + bobY;
    } else {
      this.container.x = this.currentX;
      this.container.y = this.currentY + bobY;
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
        // Check activity-based facing first
        const actState = getActivityState();
        let facingDir: number | null = null;
        if (actState) {
          const facingTargetId = getAgentFacingTarget(actState, this.id);
          if (facingTargetId) {
            // We need the target's position — store it externally
            const targetPos = this._facingTargetPos;
            if (targetPos) {
              const fdx = targetPos.x - this.currentX;
              const fdy = targetPos.y - this.currentY;
              if (Math.abs(fdx) > Math.abs(fdy)) {
                facingDir = fdx > 0 ? DIR_RIGHT : DIR_LEFT;
              } else {
                facingDir = fdy > 0 ? DIR_DOWN : DIR_UP;
              }
            }
          }
        }

        // Idle facing (fallback)
        if (facingDir === null) {
          const idleFacing = getIdleFacingDirection(this.idleBehavior);
          facingDir = idleFacing !== null ? idleFacing : this.currentDir;
        }

        const frameIdx = facingDir * SHEET_COLS + 1;
        if (this.frames[frameIdx]) {
          this.sprite.texture = this.frames[frameIdx];
        }
        this.currentDir = facingDir;
        this.animFrame = 1;
        this.animTimer = 0;
      }
    }

    // Thinking dots animation
    if (this.thinkingDots) {
      this.thinkTimer += 0.05 * dt;
      for (let i = 0; i < 3; i++) {
        const dot = this.thinkingDots.children[i + 1]; // +1 to skip bg
        if (dot) {
          dot.y = Math.sin(this.thinkTimer + i * 1.2) * 4;
        }
      }
    }

    // Selection glow pulse
    this.glowPhase += 0.04 * dt;
    if (this._selected) {
      this.drawSelectionGlow();
    }

    // Status ring pulse for active states
    if (this.lastStatus === "thinking" || this.lastStatus === "speaking" || this.lastStatus === "tool_calling") {
      const pulseAlpha = 0.15 + 0.08 * Math.sin(this.glowPhase * 2);
      const hex = STATUS_HEX[this.lastStatus] ?? 0x6b7280;
      this.statusRing.clear();
      this.statusRing.ellipse(0, 0, 22 + Math.sin(this.glowPhase * 2) * 2, 8);
      this.statusRing.fill({ color: hex, alpha: pulseAlpha });
      this.statusRing.ellipse(0, 0, 18, 6);
      this.statusRing.stroke({ color: hex, width: 1, alpha: 0.3 });
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }

  public getBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.currentX - DISPLAY_SIZE / 2,
      y: this.currentY - DISPLAY_SIZE - 10,
      width: DISPLAY_SIZE,
      height: DISPLAY_SIZE + 20,
    };
  }

  /** Set the position of the agent this one should face toward */
  public setFacingTarget(pos: { x: number; y: number } | null): void {
    this._facingTargetPos = pos;
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
