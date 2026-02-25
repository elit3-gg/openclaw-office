# OpenClaw Office — 项目规格总览

> 版本: v1.0 | 创建日期: 2026-02-25
> 状态: 规划完成，准备开发

---

## 一、项目定位

**OpenClaw Office** 是 OpenClaw Multi-Agent 系统的可视化监控前端。将 Agent 协作具象化为 Isometric 风格的"数字办公室"，让管理员实时感知、理解和干预 Agent 的工作状态。

**核心隐喻：**
- Agent = 数字员工
- 办公室 = Agent 运行时
- 工位 = Session
- 会议室 = 协作上下文
- Sub-Agent = 临时工（半透明角色）

## 二、技术栈

| 层 | 技术 | 版本 |
|-----|------|------|
| 构建工具 | Vite | 6.x |
| UI 框架 | React | 19.x |
| 2D 渲染 | SVG + CSS Animations | - |
| 2.5D/3D 渲染 | React Three Fiber (R3F) | Phase 2+ |
| 3D 辅助 | @react-three/drei | Phase 2+ |
| 后处理 | @react-three/postprocessing | Phase 3 |
| 状态管理 | Zustand + Immer | 5.x |
| 样式 | Tailwind CSS | 4.x |
| 动画 | Framer Motion | 12.x |
| 图表 | Recharts | 2.x |
| WebSocket | 原生 WebSocket API | - |
| Markdown | react-markdown | latest |
| 测试 | Vitest + @testing-library/react | latest |

## 三、系统架构

```
┌──────────────────────────────────────────────┐
│          OpenClaw Office Frontend             │
│                                              │
│  WebSocket Client ──> Zustand Store ──> 渲染层 │
│  RPC Client ──────────────┘      │           │
│                            ┌─────┴──────┐    │
│                            │ 2D SVG     │    │
│                            │ R3F 3D     │    │
│                            │ HTML Overlay│    │
│                            └────────────┘    │
└──────────────────┬───────────────────────────┘
                   │ WebSocket
                   │ ws://gateway:18789
┌──────────────────┴───────────────────────────┐
│           OpenClaw Gateway                    │
│  Agent Event Bus → broadcast("agent", ...)   │
│  RPC: agents.list, usage.status, ...         │
│  Plugin hooks: subagent_spawned/ended        │
└──────────────────────────────────────────────┘
```

## 四、Agent 状态模型

### 4.1 可视化状态枚举

```typescript
type AgentVisualStatus =
  | "idle"          // 空闲 — 绿色，休闲动画
  | "thinking"      // 思考中 — 蓝色，头顶加载圈
  | "tool_calling"  // 调用工具 — 橙色，面前弹出工具面板
  | "speaking"      // 输出文本 — 紫色，Markdown 气泡
  | "spawning"      // 派生子Agent — 特效
  | "error"         // 错误 — 红色，叹号标识
  | "offline";      // 离线 — 灰色
```

### 4.2 Gateway 事件到状态的映射

| Gateway stream | data 关键字段 | → 前端状态 |
|---------------|-------------|-----------|
| `lifecycle` | `phase: "start"` | `working` → `thinking` |
| `tool` | `name: "..."` | `tool_calling` |
| `tool` | `result: {...}` | `working`（工具完成） |
| `assistant` | `text: "..."` | `speaking` |
| `lifecycle` | `phase: "end"` | `idle` |
| `error` | `message: "..."` | `error` |

### 4.3 核心数据结构

```typescript
type VisualAgent = {
  id: string;                    // agentId
  runId?: string;                // 当前 runId
  sessionKey?: string;           // 会话标识
  name: string;                  // 显示名称
  status: AgentVisualStatus;
  position: { x: number; y: number; z: number };
  zone: "desk" | "meeting" | "hotdesk" | "lounge";

  currentTool?: { name: string; args?: Record<string, unknown> };
  speechBubble?: { text: string; timestamp: number };

  isSubAgent: boolean;
  parentAgentId?: string;
  childAgentIds: string[];

  tokenUsage?: { input: number; output: number; total: number };
  toolCallCount: number;
  lastActiveAt: number;

  avatarSeed: string;            // 确定性外观种子
  color: string;                 // 主题色
};
```

## 五、Gateway 连接协议

### 5.1 认证流程

```
1. new WebSocket("ws://gateway:18789")
2. ← connect.challenge { nonce }
3. → { type: "req", method: "connect", params: {
     minProtocol: 1, maxProtocol: 1,
     client: { id: "office-viz", version: "0.1.0",
               platform: "web", mode: "companion" },
     caps: ["tool-events"],
     auth: { token: "<pairing-token>" }
   }}
4. ← connect.accepted
5. 开始接收事件广播
```

### 5.2 广播事件帧格式

```json
{
  "type": "event",
  "event": "agent",
  "payload": {
    "runId": "abc-123",
    "seq": 42,
    "stream": "lifecycle",
    "ts": 1740478000000,
    "data": { "phase": "start" },
    "sessionKey": "session-xyz"
  }
}
```

### 5.3 RPC 请求格式

```json
// 请求
{ "type": "req", "id": "uuid-1", "method": "agents.list", "params": {} }

// 响应
{ "type": "res", "id": "uuid-1", "result": [...] }
```

### 5.4 可用 RPC 方法

| 方法 | 用途 | 调用时机 |
|------|------|---------|
| `agents.list` | Agent 配置列表 | 初始化 |
| `sessions.list` | 会话列表 | 按需 |
| `sessions.preview` | 会话预览 | Agent 详情面板 |
| `usage.status` | 用量统计 | 定时刷新 |
| `usage.cost` | 成本统计 | 指标面板 |
| `tools.catalog` | 工具目录 | 初始化 |
| `health` | 系统健康 | 心跳检查 |

## 六、分阶段里程碑

### Phase 1: 基础框架 + 2D 平面图（Week 1-2）

**目标：** 打通 Gateway → 前端的完整数据链路，用 2D SVG 平面图展示 Agent 实时状态。

| Milestone | 天数 | 核心交付 |
|-----------|------|---------|
| M1.1 项目脚手架 | Day 1-2 | Vite + React + TS + Tailwind + Zustand |
| M1.2 WS 客户端 | Day 2-3 | WebSocket 连接 + 认证 + 重连 + RPC |
| M1.3 Store + 事件处理 | Day 3-4 | Agent 状态管理 + 事件批处理 |
| M1.4 2D SVG 平面图 | Day 4-6 | 办公室平面图 + Agent 圆点 + 气泡 + 连线 |
| M1.5 面板系统 | Day 6-7 | Sidebar + AgentDetail + Metrics + Timeline |

详见 `phases/phase-1.md`

### Phase 2: Isometric 2.5D 办公室（Week 3-4）

**目标：** 升级为 isometric 视角 2.5D 场景，增加 Sub-Agent 和会议区。

| Milestone | 天数 | 核心交付 |
|-----------|------|---------|
| M2.1 R3F 基础场景 | Day 8-10 | Canvas + 相机 + 灯光 + 工位 |
| M2.2 Agent 角色系统 | Day 10-12 | 几何体小人 + Avatar + 状态动画 |
| M2.3 Sub-Agent 可视化 | Day 12-13 | 派生/消失动画 + 父子连线 |
| M2.4 会议区交互 | Day 13-14 | 协作检测 + 自动聚集 + 操作栏 |

详见 `phases/phase-2.md`

### Phase 3: 3D 增强 + 高级交互（Week 5-6）

**目标：** 提升视觉品质，增加管理员操作能力，优化性能。

| Milestone | 天数 | 核心交付 |
|-----------|------|---------|
| M3.1 视觉增强 | Day 15-17 | GLTF 模型 + Bloom + 日/夜模式 |
| M3.2 Force Action | Day 17-18 | Agent 干预操作 + 权限校验 |
| M3.3 监控面板增强 | Day 18-20 | Token 图表 + 拓扑图 + 热力图 |
| M3.4 性能优化 | Day 20-21 | InstancedMesh + LOD + 代码分割 |

详见 `phases/phase-3.md`

## 七、性能预算

| 指标 | 目标 |
|------|------|
| 首屏加载 | < 3s (LCP) |
| 事件延迟 | < 200ms |
| 内存占用 | < 200MB (50 Agent) |
| 帧率 | ≥ 30fps (2D) / ≥ 24fps (3D) |
| WS 带宽 | < 100KB/s |
| 最大 Agent | 100+ (2D) / 50 (3D) |

## 八、风险登记

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| Gateway WS 认证不兼容 | 中 | Phase 1 阻塞 | Day 1 立即跑通连接 |
| 3D 模型获取耗时 | 高 | Phase 3 延期 | Phase 2 用几何体 |
| Sub-Agent 事件未广播 | 中 | Phase 2 缺失 | 降级 RPC 轮询 |
| 大量 Agent 3D 性能不足 | 中 | 体验差 | 自动切 2D + InstancedMesh |
