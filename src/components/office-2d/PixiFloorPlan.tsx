import { useEffect, useRef } from "react";
import { Application, Container, TextureStyle } from "pixi.js";
import { useOfficeStore } from "@/store/office-store";
import { SVG_WIDTH, SVG_HEIGHT } from "@/lib/constants";
import { getActivityState } from "@/hooks/useCasualRoaming";
import { getAgentFacingTarget } from "@/lib/office-activities";
import { OfficeWorld } from "./pixi/OfficeWorld";
import { PixiAgent } from "./pixi/PixiAgent";
import { MiniMap } from "./pixi/MiniMap";
import { ConnectionLines } from "./pixi/ConnectionLines";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const PAN_SPEED = 10;

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

      // ── Layer structure ──
      // worldContainer holds everything that zooms/pans
      const worldContainer = new Container();
      worldContainer.sortableChildren = true;
      worldContainerRef.current = worldContainer;
      app.stage.addChild(worldContainer);

      // UI overlay (does NOT zoom/pan) - for minimap etc.
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

      // Mini-map click to jump
      miniMap.onJump((worldX, worldY) => {
        const screenW = app.screen.width;
        const screenH = app.screen.height;
        const z = zoomRef.current;
        panRef.current.x = screenW / 2 - worldX * z;
        panRef.current.y = screenH / 2 - worldY * z;
        applyTransform();
      });

      // Center the view initially
      const screenW = app.screen.width;
      const screenH = app.screen.height;
      const scaleX = screenW / SVG_WIDTH;
      const scaleY = screenH / SVG_HEIGHT;
      const fitZoom = Math.min(scaleX, scaleY) * 0.95;
      zoomRef.current = fitZoom;
      panRef.current.x = (screenW - SVG_WIDTH * fitZoom) / 2;
      panRef.current.y = (screenH - SVG_HEIGHT * fitZoom) / 2;

      function applyTransform() {
        const z = zoomRef.current;
        worldContainer.scale.set(z, z);
        worldContainer.x = panRef.current.x;
        worldContainer.y = panRef.current.y;

        // Update minimap viewport
        const sw = app.screen.width;
        const sh = app.screen.height;
        const vpX = -panRef.current.x / z;
        const vpY = -panRef.current.y / z;
        const vpW = sw / z;
        const vpH = sh / z;
        miniMap.updateViewport(vpX, vpY, vpW, vpH);
      }

      applyTransform();

      // ── Store subscription ──
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
              // Zoom to agent on double-click
              useOfficeStore.getState().selectAgent(id);
              zoomRef.current = Math.min(2, MAX_ZOOM);
              const sw = app.screen.width;
              const sh = app.screen.height;
              const z = zoomRef.current;
              panRef.current.x = sw / 2 - agent.position.x * z;
              panRef.current.y = sh / 2 - agent.position.y * z;
              applyTransform();
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

        // Update connection lines on next tick (links ref)
        (connectionLinesRef.current as any).__links = state.links;
        (connectionLinesRef.current as any).__agents = storeAgents;
      });

      // ── Ticker ──
      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime;

        // Arrow key panning
        const keys = keysRef.current;
        const panSpeed = PAN_SPEED * dt;
        if (keys.has("ArrowLeft") || keys.has("a")) panRef.current.x += panSpeed;
        if (keys.has("ArrowRight") || keys.has("d")) panRef.current.x -= panSpeed;
        if (keys.has("ArrowUp") || keys.has("w")) panRef.current.y += panSpeed;
        if (keys.has("ArrowDown") || keys.has("s")) panRef.current.y -= panSpeed;
        if (keys.size > 0) applyTransform();

        // Update world particles
        world.tick(dt);

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

      // ── Input handlers ──
      const canvas = app.canvas;

      // Wheel zoom
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

        zoomRef.current = newZoom;
        panRef.current.x = mx - worldX * newZoom;
        panRef.current.y = my - worldY * newZoom;

        applyTransform();
      };
      canvas.addEventListener("wheel", onWheel, { passive: false });

      // Middle-click or Ctrl+drag pan
      const onPointerDown = (e: PointerEvent) => {
        if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
          isPanningRef.current = true;
          lastMouseRef.current = { x: e.clientX, y: e.clientY };
          e.preventDefault();
        }
      };
      const onPointerMove = (e: PointerEvent) => {
        if (isPanningRef.current) {
          const dx = e.clientX - lastMouseRef.current.x;
          const dy = e.clientY - lastMouseRef.current.y;
          panRef.current.x += dx;
          panRef.current.y += dy;
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
        }
        // Reset view with 'r'
        if (e.key === "r" || e.key === "R") {
          const sw = app.screen.width;
          const sh = app.screen.height;
          const sx = sw / SVG_WIDTH;
          const sy = sh / SVG_HEIGHT;
          zoomRef.current = Math.min(sx, sy) * 0.95;
          panRef.current.x = (sw - SVG_WIDTH * zoomRef.current) / 2;
          panRef.current.y = (sh - SVG_HEIGHT * zoomRef.current) / 2;
          applyTransform();
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
