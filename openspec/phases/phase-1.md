# Phase 1: 基础框架 + 2D 平面图

> 工期: Week 1-2 (Day 1-7)
> 目标: 打通 Gateway → 前端的完整数据链路，用 2D SVG 平面图展示 Agent 实时状态

---

## M1.1 项目脚手架（Day 1-2）

### 任务

1. **安装依赖**：在项目根目录执行 `pnpm install`
2. **验证 Tailwind**：确认 Tailwind 4 通过 @tailwindcss/vite 插件生效
3. **验证开发服务器**：`pnpm dev` 可启动，浏览器访问 `http://localhost:5180` 看到 App
4. **AppShell 布局**：创建 `src/components/layout/AppShell.tsx`
   - 顶栏（高度 48px）：Logo + 项目名 + 连接状态指示 + 设置按钮
   - 侧栏（宽度 280px，可折叠）：Agent 列表区域
   - 主区域：2D/3D 场景渲染区
   - 参考设计图4（左侧场景 + 右侧面板）的布局模式
5. **Vitest 配置**：确认 `pnpm test` 可运行

### 验收标准

- [ ] `pnpm dev` 启动后浏览器正常渲染 AppShell 布局
- [ ] Tailwind 类名（如 `bg-gray-950`）生效
- [ ] `pnpm test` 可运行（即使还没有测试用例）
- [ ] 目录结构与 project.md 描述一致

---

## M1.2 Gateway WebSocket 客户端（Day 2-3）

### 任务

#### 1. `src/gateway/types.ts` — Gateway 协议类型

```typescript
// 从 OpenClaw 主项目提取的关键类型

export type GatewayFrame =
  | GatewayEventFrame
  | GatewayResponseFrame;

export type GatewayEventFrame = {
  type: "event";
  event: string;
  payload: unknown;
  seq?: number;
};

export type GatewayResponseFrame = {
  type: "res";
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
};

export type GatewayRequest = {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
};

export type AgentEventPayload = {
  runId: string;
  seq: number;
  stream: "lifecycle" | "tool" | "assistant" | "error" | string;
  ts: number;
  data: Record<string, unknown>;
  sessionKey?: string;
};

export type ConnectParams = {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    version: string;
    platform: string;
    mode: string;
  };
  caps?: string[];
  auth?: { token: string };
};
```

#### 2. `src/gateway/ws-client.ts` — WebSocket 客户端

核心行为：
- `connect(url, token)` — 建立连接
- 收到 `connect.challenge` → 自动发送 connect 请求
- 收到 `connect.accepted` → 标记已连接，触发回调
- 收到 `event:agent` → 分发到事件回调
- 断线自动重连：延迟 = `min(1000 * 2^attempt, 30000)` + 随机抖动(0-1000ms)
- 提供 `onEvent(callback)`、`onStatusChange(callback)` 注册接口

#### 3. `src/gateway/rpc-client.ts` — RPC 封装

- `request<T>(method, params): Promise<T>` — 发送 req，等待 res
- 超时处理（10s 默认）
- 请求 ID 用 `crypto.randomUUID()`

#### 4. `src/gateway/event-parser.ts` — 事件解析

- 接收原始 `GatewayEventFrame`
- 提取 `AgentEventPayload`
- 根据 `stream` + `data` 字段推断 `AgentVisualStatus`

#### 5. `src/gateway/mock-provider.ts` — Mock 模式

当 `VITE_MOCK=true` 时使用：
- 模拟 3-5 个 Agent
- 每 2-5 秒随机产生事件（lifecycle start → tool → assistant → lifecycle end）
- 偶尔产生 Sub-Agent spawn/end 事件
- 提供与真实 ws-client 相同的接口

#### 6. `src/hooks/useGatewayConnection.ts`

React Hook 封装：
- 初始化时自动连接（或启用 Mock）
- 暴露 `connectionStatus`、`rpc` 方法
- 将事件分发到 Zustand store

### 验收标准

- [ ] `VITE_MOCK=true` 时前端正常启动，TopBar 显示 "Mock 模式"
- [ ] 真实 Gateway 运行时，前端可连接并完成认证
- [ ] 断开后自动重连，TopBar 显示重连中状态
- [ ] RPC 可调用 `agents.list` 并获得结果
- [ ] event-parser 有单元测试覆盖所有 stream 类型

---

## M1.3 Zustand Store + 事件驱动更新（Day 3-4）

### 任务

#### 1. `src/store/office-store.ts`

使用 Zustand + Immer：

```typescript
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export const useOfficeStore = create<OfficeStore>()(
  immer((set, get) => ({
    agents: new Map(),
    links: [],
    globalMetrics: { totalTokens: 0, activeAgents: 0, collaborationHeat: 0, tokenRate: 0 },
    connectionStatus: "disconnected",
    selectedAgentId: null,
    viewMode: "overview",
    renderMode: "2d",
    theme: "dark",
    // ... actions
  }))
);
```

#### 2. `src/store/agent-reducer.ts`

处理 AgentEventPayload → VisualAgent 更新：

- `stream: "lifecycle"` + `phase: "start"` → 创建/更新 agent 状态为 `thinking`
- `stream: "tool"` + 有 `name` → 更新为 `tool_calling`，设置 `currentTool`
- `stream: "tool"` + 有 `result` → 清除 `currentTool`
- `stream: "assistant"` → 更新为 `speaking`，设置 `speechBubble`
- `stream: "lifecycle"` + `phase: "end"` → 更新为 `idle`
- `stream: "error"` → 更新为 `error`

#### 3. `src/lib/event-throttle.ts`

事件批处理器：
- 收集事件到队列
- 每 100ms flush 一次，批量更新 store
- `lifecycle` 和 `error` 事件立即处理（高优先级）

### 验收标准

- [ ] Mock 模式下，store 中的 agents 数据随事件实时更新
- [ ] 多个 Agent 并发事件不导致 UI 卡顿
- [ ] office-store 单元测试：验证各种事件的状态转换
- [ ] 初始化时从 RPC 加载 Agent 列表

---

## M1.4 2D SVG 平面图（Day 4-6）

### 任务

#### 1. `src/components/office-2d/FloorPlan.tsx`

SVG 办公室平面图：
- ViewBox: `0 0 1000 600`
- 区域定义（`src/lib/constants.ts`）：
  - **Desk Zone**（固定工位区）：左上，网格排列 8-12 个工位
  - **Meeting Zone**（会议区）：右上，圆桌 + 周围座位
  - **Hot Desk Zone**（热工位区）：左下，3-5 个临时工位
  - **Lounge Zone**（休息区）：右下，装饰性区域
- 每个区域用不同底色的 `<rect>` 和 `<text>` 标签标识

#### 2. `src/components/office-2d/AgentDot.tsx`

Agent 圆点渲染：
- 直径 20px 的圆，填充色由状态决定：
  - idle: `#22c55e` (绿)
  - thinking: `#3b82f6` (蓝)
  - tool_calling: `#f97316` (橙)
  - speaking: `#a855f7` (紫)
  - error: `#ef4444` (红)
  - offline: `#6b7280` (灰)
- CSS transition 实现位移平滑动画（duration 600ms）
- 悬停显示 Agent 名称 tooltip
- 点击触发 `selectAgent(id)`

#### 3. `src/components/office-2d/ConnectionLine.tsx`

Agent 间连线：
- SVG `<line>` 或 `<path>`
- `stroke-dasharray: "5,5"` 虚线
- 颜色和透明度由 `strength` 控制
- 动画：dash-offset 循环动画模拟数据流动

#### 4. `src/components/overlays/SpeechBubble.tsx`

对话气泡：
- 定位在 Agent 圆点上方
- 使用 react-markdown 渲染内容
- 最大宽度 240px，超过滚动
- 3 秒无新内容后自动淡出

#### 5. `src/lib/position-allocator.ts`

工位分配算法：
- 输入：agentId, isSubAgent, 当前已分配的位置
- 输出：`{ x, y }` 坐标
- 常驻 Agent：基于 agentId hash 确定性分配到 Desk Zone
- Sub-Agent：顺序分配到 Hot Desk Zone 空闲位置

### 验收标准

- [ ] 页面显示完整的 SVG 办公室平面图，有四个清晰的区域
- [ ] Mock 模式下 Agent 圆点出现在正确的位置
- [ ] Agent 状态变化时圆点颜色平滑过渡
- [ ] 点击圆点可选中 Agent
- [ ] 协作中的 Agent 间有虚线连线
- [ ] speaking 状态的 Agent 显示 Markdown 气泡

---

## M1.5 右侧面板 + 指标（Day 6-7）

### 任务

#### 1. `src/components/layout/Sidebar.tsx`

Agent 列表侧栏：
- 搜索框（按名称过滤）
- 状态过滤标签（All / Active / Idle / Error）
- Agent 卡片列表：Avatar + 名称 + 状态标签 + 最后活跃时间
- 点击卡片 = 选中 Agent

#### 2. `src/components/panels/AgentDetailPanel.tsx`

选中 Agent 后的详情面板：
- Agent Avatar + 名称 + 状态
- 当前任务描述
- 当前工具（如果 tool_calling 状态）
- 最近的 speechBubble 内容
- Tool Call History（最近 10 次工具调用列表）
- Token 使用量

#### 3. `src/components/panels/MetricsPanel.tsx`

全局指标卡片：
- Active Agents（数字 + 小图标）
- Total Tokens（格式化显示，如 87k）
- Collaboration Heat（百分比进度条）
- Token Rate（tokens/min）

#### 4. `src/components/panels/EventTimeline.tsx`

事件时间轴：
- 最近 50 条事件
- 每条显示：时间戳 + Agent 名称 + 事件类型 + 简要描述
- 颜色编码同 Agent 状态色
- 自动滚动到最新事件

#### 5. `src/components/shared/Avatar.tsx`

确定性 Avatar：
- 输入 agentId → 输出 SVG 头像
- 基于 hash 确定：背景色、文字颜色、首字母
- 简单的圆形首字母 Avatar（Phase 3 再增强）

### 验收标准

- [ ] 侧栏显示所有 Agent，支持搜索和过滤
- [ ] 点击 Agent 展开详情面板
- [ ] 全局指标卡片实时更新
- [ ] 事件时间轴自动更新和滚动
- [ ] Avatar 对同一 Agent 始终显示相同外观
