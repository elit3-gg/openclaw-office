import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Text, TextStyle, TextureStyle } from "pixi.js";
import { useOfficeStore } from "@/store/office-store";
import { SVG_WIDTH, SVG_HEIGHT, ZONES } from "@/lib/constants";
import { getActivityState } from "@/hooks/useCasualRoaming";
import { getAgentFacingTarget } from "@/lib/office-activities";
import { OfficeWorld } from "./pixi/OfficeWorld";
import { PixiAgent } from "./pixi/PixiAgent";
import { MiniMap } from "./pixi/MiniMap";
import { ConnectionLines } from "./pixi/ConnectionLines";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const PAN_SPEED = 10;

// Spring physics constants
const SPRING_STIFFNESS = 8;  // Higher = snappier
const SPRING_DAMPING = 4;    // Higher = less bouncy

// Camera shake
const SHAKE_INTENSITY = 3;
const SHAKE_DECAY = 0.9;

export function PixiFloorPlan() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const destroyedRef = useRef(false);

  // Refs for pixi objects so we can access them in callbacks
  const worldRef = useRef<OfficeWorld | null>(null);
  const agentMapRef = useRef<Map<string, PixiAgent>>(new Map());
  const miniMapRef = useRef<MiniMap | null>(null);
  const connectionLinesRef = useRef<ConnectionLines | null>(null);
  const worldContainerRef = useRef<Container | null>(null);

  // Camera state
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const keysRef = useRef<Set<string>>(new Set());

  // Spring camera state
  const targetZoomRef = useRef(1);
  const zoomVelocityRef = useRef(0);
  const targetPanRef = useRef({ x: 0, y: 0 });
  const panVelocityRef = useRef({ x: 0, y: 0 });
  const useSpringRef = useRef(false); // Only use spring for zoom/focus actions

  // Camera shake state
  const shakeRef = useRef({ x: 0, y: 0, intensity: 0 });

  // Track error statuses for camera shake
  const prevErrorCountRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    destroyedRef.current = false;

    // Set pixel art scale mode
    TextureStyle.defaultOptions.scaleMode = "nearest";

    const app = new Application();
    appRef.current = app;

    const init = async () => {
      await app.init({
        resizeTo: el,
        background: 0x0d0d1a,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (destroyedRef.current) {
        app.destroy(true);
        return;
      }

      el.appendChild(app.canvas);

      // -- Layer structure --
      // worldContainer holds everything that zooms/pans
      const worldContainer = new Container();
      worldContainer.sortableChildren = true;
      worldContainerRef.current = worldContainer;
      app.stage.addChild(worldContainer);

      // UI overlay (does NOT zoom/pan) - for minimap, HUD etc.
      const uiLayer = new Container();
      uiLayer.sortableChildren = true;
      app.stage.addChild(uiLayer);

      // Background + Floor + Furniture + Walls
      const world = new OfficeWorld();
      world.container.zIndex = 0;
      worldContainer.addChild(world.container);
      worldRef.current = world;

      // Connection lines layer
      const connLines = new ConnectionLines();
      connLines.graphics.zIndex = 5;
      worldContainer.addChild(connLines.graphics);
      connectionLinesRef.current = connLines;

      // Agents layer
      const agentsLayer = new Container();
      agentsLayer.sortableChildren = true;
      agentsLayer.zIndex = 10;
      worldContainer.addChild(agentsLayer);

      // Mini-map
      const miniMap = new MiniMap();
      miniMap.container.zIndex = 100;
      uiLayer.addChild(miniMap.container);
      miniMapRef.current = miniMap;

      // Position minimap
      miniMap.position(app.screen.width, app.screen.height);

      // ── HUD Buttons ──
      const hudContainer = new Container();
      hudContainer.zIndex = 101;
      uiLayer.addChild(hudContainer);

      // Grid toggle button
      const gridBtnBg = new Graphics();
      const gridBtnLabel = new Text({
        text: "GRID",
        style: new TextStyle({
          fontSize: 8,
          fontFamily: "'JetBrains Mono', monospace",
          fill: 0x9a8aff,
          fontWeight: "bold",
          letterSpacing: 1,
        }),
      });
      gridBtnLabel.anchor.set(0.5, 0.5);
      gridBtnLabel.x = 28;
      gridBtnLabel.y = 12;

      const drawGridBtn = (active: boolean) => {
        gridBtnBg.clear();
        gridBtnBg.roundRect(0, 0, 56, 24, 4);
        gridBtnBg.fill({ color: 0x0d0d1a, alpha: 0.85 });
        gridBtnBg.stroke({ color: active ? 0x9a8aff : 0x4a4a6a, width: 1, alpha: active ? 0.8 : 0.4 });
      };
      drawGridBtn(false);

      const gridBtn = new Container();
      gridBtn.addChild(gridBtnBg);
      gridBtn.addChild(gridBtnLabel);
      gridBtn.eventMode = "static";
      gridBtn.cursor = "pointer";
      let gridActive = false;
      gridBtn.on("pointerdown", () => {
        world.toggleGrid();
        gridActive = !gridActive;
        drawGridBtn(gridActive);
      });
      hudContainer.addChild(gridBtn);

      // Zoom level indicator
      const zoomText = new Text({
        text: "1.0x",
        style: new TextStyle({
          fontSize: 8,
          fontFamily: "'JetBrains Mono', monospace",
          fill: 0x7a7a9a,
          fontWeight: "bold",
          letterSpacing: 1,
        }),
      });
      zoomText.anchor.set(0.5, 0.5);
      const zoomBg = new Graphics();
      zoomBg.roundRect(0, 0, 46, 24, 4);
      zoomBg.fill({ color: 0x0d0d1a, alpha: 0.85 });
      zoomBg.stroke({ color: 0x4a4a6a, width: 1, alpha: 0.4 });
      const zoomContainer = new Container();
      zoomText.x = 23;
      zoomText.y = 12;
      zoomContainer.addChild(zoomBg);
      zoomContainer.addChild(zoomText);
      zoomContainer.x = 62;
      hudContainer.addChild(zoomContainer);

      // Agent count badge
      const agentCountText = new Text({
        text: "0",
        style: new TextStyle({
          fontSize: 8,
          fontFamily: "'JetBrains Mono', monospace",
          fill: 0x22c55e,
          fontWeight: "bold",
        }),
      });
      agentCountText.anchor.set(0.5, 0.5);
      const agentBadgeBg = new Graphics();
      agentBadgeBg.roundRect(0, 0, 56, 24, 4);
      agentBadgeBg.fill({ color: 0x0d0d1a, alpha: 0.85 });
      agentBadgeBg.stroke({ color: 0x22c55e, width: 1, alpha: 0.3 });
      const agentBadge = new Container();
      const agentBadgeIcon = new Text({
        text: "AG",
        style: new TextStyle({
          fontSize: 6,
          fontFamily: "'JetBrains Mono', monospace",
          fill: 0x6a6a8a,
          letterSpacing: 1,
        }),
      });
      agentBadgeIcon.anchor.set(1, 0.5);
      agentBadgeIcon.x = 22;
      agentBadgeIcon.y = 12;
      agentCountText.x = 38;
      agentCountText.y = 12;
      agentBadge.addChild(agentBadgeBg);
      agentBadge.addChild(agentBadgeIcon);
      agentBadge.addChild(agentCountText);
      agentBadge.x = 114;
      hudContainer.addChild(agentBadge);

      // Position HUD in bottom-left
      const positionHUD = () => {
        hudContainer.x = 12;
        hudContainer.y = app.screen.height - 36;
      };
      positionHUD();

      // Mini-map click to jump (with smooth lerp)
      miniMap.onJump((worldX, worldY) => {
        const screenW = app.screen.width;
        const screenH = app.screen.height;
        const z = zoomRef.current;
        targetPanRef.current.x = screenW / 2 - worldX * z;
        targetPanRef.current.y = screenH / 2 - worldY * z;
        targetZoomRef.current = z;
        useSpringRef.current = true;
      });

      // Center the view initially
      const screenW = app.screen.width;
      const screenH = app.screen.height;
      const scaleX = screenW / SVG_WIDTH;
      const scaleY = screenH / SVG_HEIGHT;
      const fitZoom = Math.min(scaleX, scaleY) * 0.95;
      zoomRef.current = fitZoom;
      targetZoomRef.current = fitZoom;
      panRef.current.x = (screenW - SVG_WIDTH * fitZoom) / 2;
      panRef.current.y = (screenH - SVG_HEIGHT * fitZoom) / 2;
      targetPanRef.current.x = panRef.current.x;
      targetPanRef.current.y = panRef.current.y;

      function applyTransform() {
        const z = zoomRef.current;
        const shake = shakeRef.current;
        worldContainer.scale.set(z, z);
        worldContainer.x = panRef.current.x + shake.x;
        worldContainer.y = panRef.current.y + shake.y;

        // Update minimap viewport
        const sw = app.screen.width;
        const sh = app.screen.height;
        const vpX = -panRef.current.x / z;
        const vpY = -panRef.current.y / z;
        const vpW = sw / z;
        const vpH = sh / z;
        miniMap.updateViewport(vpX, vpY, vpW, vpH);

        // Update zoom text
        zoomText.text = z.toFixed(1) + "x";
      }

      applyTransform();

      // -- Store subscription --
      const agentPixiMap = agentMapRef.current;

      const unsub = useOfficeStore.subscribe((state) => {
        // Sync agents
        const storeAgents = state.agents;
        const currentIds = new Set(storeAgents.keys());

        // Remove agents no longer in store
        for (const [id, pixiAgent] of agentPixiMap) {
          if (!currentIds.has(id)) {
            agentsLayer.removeChild(pixiAgent.container);
            pixiAgent.destroy();
            agentPixiMap.delete(id);
          }
        }

        // Add or update agents
        for (const [id, agent] of storeAgents) {
          let pixiAgent = agentPixiMap.get(id);
          if (!pixiAgent) {
            pixiAgent = new PixiAgent(agent);
            pixiAgent.container.eventMode = "static";
            pixiAgent.container.cursor = "pointer";
            pixiAgent.container.on("pointerdown", () => {
              useOfficeStore.getState().selectAgent(id);
            });
            pixiAgent.container.on("pointerdblclick", () => {
              // Smooth zoom to agent on double-click
              useOfficeStore.getState().selectAgent(id);
              targetZoomRef.current = Math.min(2, MAX_ZOOM);
              const sw = app.screen.width;
              const sh = app.screen.height;
              targetPanRef.current.x = sw / 2 - agent.position.x * targetZoomRef.current;
              targetPanRef.current.y = sh / 2 - agent.position.y * targetZoomRef.current;
              useSpringRef.current = true;
            });
            agentsLayer.addChild(pixiAgent.container);
            agentPixiMap.set(id, pixiAgent);
          }
          pixiAgent.updateFromAgent(agent);

          // Update selection state
          pixiAgent.setSelected(state.selectedAgentId === id);
        }

        // Update minimap agents
        miniMap.updateAgents(storeAgents);

        // Update agent count badge
        agentCountText.text = String(storeAgents.size);

        // Count agents per zone for world activity indicators
        const zoneCounts: Record<string, number> = {};
        for (const key of Object.keys(ZONES)) zoneCounts[key] = 0;
        for (const [, agent] of storeAgents) {
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
        world.updateZoneAgentCounts(zoneCounts);

        // Check for error statuses -> camera shake
        let errorCount = 0;
        for (const [, agent] of storeAgents) {
          if (agent.status === "error") errorCount++;
        }
        if (errorCount > prevErrorCountRef.current) {
          shakeRef.current.intensity = SHAKE_INTENSITY;
        }
        prevErrorCountRef.current = errorCount;

        // Update connection lines on next tick (links ref)
        (connectionLinesRef.current as any).__links = state.links;
        (connectionLinesRef.current as any).__agents = storeAgents;
      });

      // -- Ticker --
      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime;
        const dtSec = dt / 60;

        // Spring physics for camera
        if (useSpringRef.current) {
          // Zoom spring
          const zoomDiff = targetZoomRef.current - zoomRef.current;
          zoomVelocityRef.current += zoomDiff * SPRING_STIFFNESS * dtSec;
          zoomVelocityRef.current *= Math.pow(1 - SPRING_DAMPING * dtSec, dt);
          zoomRef.current += zoomVelocityRef.current * dtSec;

          // Pan spring
          const panDiffX = targetPanRef.current.x - panRef.current.x;
          const panDiffY = targetPanRef.current.y - panRef.current.y;
          panVelocityRef.current.x += panDiffX * SPRING_STIFFNESS * dtSec;
          panVelocityRef.current.y += panDiffY * SPRING_STIFFNESS * dtSec;
          panVelocityRef.current.x *= Math.pow(1 - SPRING_DAMPING * dtSec, dt);
          panVelocityRef.current.y *= Math.pow(1 - SPRING_DAMPING * dtSec, dt);
          panRef.current.x += panVelocityRef.current.x * dtSec;
          panRef.current.y += panVelocityRef.current.y * dtSec;

          // Stop spring when close enough
          const totalDist = Math.abs(zoomDiff) + Math.abs(panDiffX) + Math.abs(panDiffY);
          const totalVel = Math.abs(zoomVelocityRef.current) +
            Math.abs(panVelocityRef.current.x) +
            Math.abs(panVelocityRef.current.y);
          if (totalDist < 0.01 && totalVel < 0.01) {
            zoomRef.current = targetZoomRef.current;
            panRef.current.x = targetPanRef.current.x;
            panRef.current.y = targetPanRef.current.y;
            zoomVelocityRef.current = 0;
            panVelocityRef.current.x = 0;
            panVelocityRef.current.y = 0;
            useSpringRef.current = false;
          }

          applyTransform();
        }

        // Camera shake decay
        const shake = shakeRef.current;
        if (shake.intensity > 0.05) {
          shake.x = (Math.random() - 0.5) * 2 * shake.intensity;
          shake.y = (Math.random() - 0.5) * 2 * shake.intensity;
          shake.intensity *= SHAKE_DECAY;
          applyTransform();
        } else if (shake.intensity > 0) {
          shake.x = 0;
          shake.y = 0;
          shake.intensity = 0;
          applyTransform();
        }

        // Arrow key panning
        const keys = keysRef.current;
        const panSpeed = PAN_SPEED * dt;
        let keyPanned = false;
        if (keys.has("ArrowLeft") || keys.has("a")) { panRef.current.x += panSpeed; keyPanned = true; }
        if (keys.has("ArrowRight") || keys.has("d")) { panRef.current.x -= panSpeed; keyPanned = true; }
        if (keys.has("ArrowUp") || keys.has("w")) { panRef.current.y += panSpeed; keyPanned = true; }
        if (keys.has("ArrowDown") || keys.has("s")) { panRef.current.y -= panSpeed; keyPanned = true; }
        if (keyPanned) {
          // Sync target to current (cancel spring if user takes manual control)
          targetPanRef.current.x = panRef.current.x;
          targetPanRef.current.y = panRef.current.y;
          useSpringRef.current = false;
          applyTransform();
        }

        // Update world particles
        world.tick(dt);

        // Tick minimap animation
        miniMap.tick(dt);

        // Tick movement for all walking agents (advance path progress)
        const store = useOfficeStore.getState();
        const deltaSeconds = dt / 60; // PixiJS dt is in frames (~60fps)
        for (const [id, agent] of store.agents) {
          if (agent.movement) {
            store.tickMovement(id, deltaSeconds);
          }
        }

        // Update agents + activity facing
        const actState = getActivityState();
        for (const [id, pixiAgent] of agentPixiMap) {
          // Re-read position after tickMovement updated it
          const freshAgent = store.agents.get(id);
          if (freshAgent) {
            pixiAgent.updateFromAgent(freshAgent);
          }
          // Set facing target from activity system
          if (actState) {
            const facingId = getAgentFacingTarget(actState, id);
            if (facingId) {
              const targetAgent = store.agents.get(facingId);
              if (targetAgent) {
                pixiAgent.setFacingTarget({ x: targetAgent.position.x, y: targetAgent.position.y });
              } else {
                pixiAgent.setFacingTarget(null);
              }
            } else {
              pixiAgent.setFacingTarget(null);
            }
          }
          pixiAgent.tick(dt);
        }

        // Update connection lines
        const cl = connectionLinesRef.current;
        if (cl) {
          const links = (cl as any).__links ?? [];
          const agents = (cl as any).__agents ?? new Map();
          cl.update(links, agents, dt);
        }
      });

      // -- Input handlers --
      const canvas = app.canvas;

      // Wheel zoom (with spring physics)
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current * zoomFactor));

        // Zoom toward mouse position
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const oldZoom = zoomRef.current;
        const worldX = (mx - panRef.current.x) / oldZoom;
        const worldY = (my - panRef.current.y) / oldZoom;

        // Set spring targets
        targetZoomRef.current = newZoom;
        targetPanRef.current.x = mx - worldX * newZoom;
        targetPanRef.current.y = my - worldY * newZoom;
        useSpringRef.current = true;
      };
      canvas.addEventListener("wheel", onWheel, { passive: false });

      // Middle-click or Ctrl+drag pan
      const onPointerDown = (e: PointerEvent) => {
        if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
          isPanningRef.current = true;
          lastMouseRef.current = { x: e.clientX, y: e.clientY };
          useSpringRef.current = false; // Cancel spring during manual pan
          e.preventDefault();
        }
      };
      const onPointerMove = (e: PointerEvent) => {
        if (isPanningRef.current) {
          const dx = e.clientX - lastMouseRef.current.x;
          const dy = e.clientY - lastMouseRef.current.y;
          panRef.current.x += dx;
          panRef.current.y += dy;
          targetPanRef.current.x = panRef.current.x;
          targetPanRef.current.y = panRef.current.y;
          lastMouseRef.current = { x: e.clientX, y: e.clientY };
          applyTransform();
        }
      };
      const onPointerUp = (e: PointerEvent) => {
        if (e.button === 1 || e.button === 0) {
          isPanningRef.current = false;
        }
      };
      canvas.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);

      // Keyboard pan
      const onKeyDown = (e: KeyboardEvent) => {
        keysRef.current.add(e.key);
        // Toggle grid with 'g'
        if (e.key === "g" || e.key === "G") {
          world.toggleGrid();
          gridActive = !gridActive;
          drawGridBtn(gridActive);
        }
        // Reset view with 'r'
        if (e.key === "r" || e.key === "R") {
          const sw = app.screen.width;
          const sh = app.screen.height;
          const sx = sw / SVG_WIDTH;
          const sy = sh / SVG_HEIGHT;
          targetZoomRef.current = Math.min(sx, sy) * 0.95;
          targetPanRef.current.x = (sw - SVG_WIDTH * targetZoomRef.current) / 2;
          targetPanRef.current.y = (sh - SVG_HEIGHT * targetZoomRef.current) / 2;
          useSpringRef.current = true;
        }
      };
      const onKeyUp = (e: KeyboardEvent) => {
        keysRef.current.delete(e.key);
      };
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);

      // Resize handler
      const onResize = () => {
        miniMap.position(app.screen.width, app.screen.height);
        positionHUD();
        applyTransform();
      };
      const ro = new ResizeObserver(onResize);
      ro.observe(el);

      // Store cleanup references on the app for the cleanup function
      (app as any).__cleanup = () => {
        unsub();
        canvas.removeEventListener("wheel", onWheel);
        canvas.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        ro.disconnect();

        // Destroy pixi agents
        for (const [, pixiAgent] of agentPixiMap) {
          pixiAgent.destroy();
        }
        agentPixiMap.clear();

        world.destroy();
        miniMap.destroy();
        connLines.destroy();
      };
    };

    init();

    return () => {
      destroyedRef.current = true;
      const a = appRef.current;
      if (a) {
        (a as any).__cleanup?.();
        try {
          a.destroy(true, { children: true });
        } catch {
          // ignore destroy errors during hot reload
        }
        appRef.current = null;
      }
      // Remove canvas if still attached
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      style={{ background: "#0d0d1a" }}
    />
  );
}
