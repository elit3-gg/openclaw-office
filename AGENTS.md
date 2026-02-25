# OpenClaw Office — Agent 开发指南

本文档为 AI 编码助手（Codex、Claude、Cursor Agent 等）提供项目开发的上下文和规则。

## 项目概述

OpenClaw Office 是一个可视化监控前端，将 OpenClaw Multi-Agent 系统的 Agent 协作具象化为"数字办公室"。前端通过 WebSocket 连接 OpenClaw Gateway，消费 Agent 事件并实时渲染。

## 技术栈

- **语言：** TypeScript (ESM, strict mode)
- **UI 框架：** React 19
- **构建工具：** Vite 6
- **状态管理：** Zustand 5 + Immer
- **样式：** Tailwind CSS 4
- **2D 渲染：** SVG + CSS Animations
- **3D 渲染：** React Three Fiber (R3F) + @react-three/drei（Phase 2+）
- **图表：** Recharts
- **测试：** Vitest + @testing-library/react
- **实时通信：** 原生 WebSocket API

## 目录结构

```
src/
├── main.tsx              # 入口
├── App.tsx               # 根组件
├── gateway/              # Gateway 通信层（WS 客户端、RPC、事件解析）
├── store/                # Zustand 状态管理（Agent 状态、指标聚合）
├── components/
│   ├── layout/           # 页面布局
│   ├── office-2d/        # 2D SVG 平面图组件
│   ├── office-3d/        # 3D R3F 场景组件
│   ├── overlays/         # HTML Overlay（气泡、面板）
│   ├── panels/           # 侧边/弹窗面板
│   └── shared/           # 公共组件
├── hooks/                # 自定义 React Hooks
├── lib/                  # 工具函数库
└── styles/               # 全局样式
```

## 开发命令

```bash
pnpm install              # 安装依赖
pnpm dev                  # 启动开发服务器 (port 5180)
pnpm build                # 构建生产版本
pnpm test                 # 运行测试
pnpm test:watch           # 测试 watch 模式
pnpm typecheck            # TypeScript 类型检查
pnpm lint                 # Oxlint 检查
pnpm format               # Oxfmt 格式化
pnpm check                # lint + format 检查
```

## 编码规范

- TypeScript strict 模式，**不用 `any`**
- 文件不超过 500 行，超过则拆分
- 组件命名 PascalCase，hook 命名 useCamelCase
- 使用 Oxlint + Oxfmt 规范（与 OpenClaw 主项目一致）
- 不添加 `@ts-nocheck`
- 注释仅用于解释非显而易见的逻辑，不做代码叙述

## OpenClaw Gateway 集成

### 连接

前端通过 WebSocket 连接 Gateway（默认 `ws://localhost:18789`）。

### 认证流程

1. 建立 WebSocket 连接
2. Gateway 发送 `connect.challenge`（含 nonce）
3. 前端发送 `connect` 请求，包含 client info 和 auth token
4. Gateway 返回 `connect.accepted`

### 事件订阅

连接后自动接收 Gateway 广播的事件：

| 事件 | 内容 |
|------|------|
| `agent` | Agent 生命周期、工具调用、文本输出、错误 |
| `presence` | 在线设备/客户端列表 |
| `health` | 系统健康快照 |
| `heartbeat` | 心跳 |

### Agent 事件 Payload 格式

```typescript
type AgentEventPayload = {
  runId: string;
  seq: number;
  stream: "lifecycle" | "tool" | "assistant" | "error";
  ts: number;
  data: Record<string, unknown>;
  sessionKey?: string;
};
```

### RPC 方法

通过 WebSocket 调用：

- `agents.list` — 获取 Agent 配置列表
- `sessions.list` — 获取会话列表
- `usage.status` — 获取用量统计
- `tools.catalog` — 获取工具目录

### 关键参考文件（OpenClaw 主项目）

以下文件位于 OpenClaw 主仓库（父级目录），包含 Gateway 协议和类型的权威定义：

- `src/infra/agent-events.ts` — AgentEventPayload 类型定义
- `src/gateway/protocol/schema/frames.ts` — WS 帧格式（ConnectParams 等）
- `src/gateway/server/ws-connection.ts` — WS 认证流程实现
- `src/agents/subagent-spawn.ts` — SubAgent 派生类型
- `src/agents/subagent-registry.types.ts` — SubAgent 运行记录
- `src/agents/subagent-lifecycle-events.ts` — SubAgent 生命周期状态
- `src/gateway/server-methods-list.ts` — 所有 Gateway 事件/方法名
- `src/config/types.agents.ts` — Agent 配置类型
- `src/plugins/types.ts` — Plugin API 类型

## Agent 状态映射

前端将 Gateway 事件映射为以下可视化状态：

| Gateway stream | data 关键字段 | 前端状态 | 视觉表现 |
|---------------|-------------|---------|---------|
| `lifecycle` | `phase: "start"` | `working` | 角色坐正 + 加载动画 |
| `lifecycle` | `phase: "end"` | `idle` | 回到休闲状态 |
| `tool` | `name: "xxx"` | `tool_calling` | 工具面板弹出 |
| `assistant` | `text: "..."` | `speaking` | Markdown 气泡 |
| `error` | `message: "..."` | `error` | 红色叹号标识 |

## Mock 模式

设置环境变量 `VITE_MOCK=true` 可在不连接 Gateway 的情况下使用模拟数据开发。Mock provider 位于 `src/gateway/mock-provider.ts`。

## 分阶段开发顺序

**严格按以下顺序执行，每个 Milestone 验收通过后再进入下一个：**

1. **Phase 1（Week 1-2）：** 项目脚手架 → WS 客户端 → Zustand Store → 2D SVG 平面图 → 面板系统
2. **Phase 2（Week 3-4）：** R3F 基础场景 → Agent 角色系统 → Sub-Agent 可视化 → 会议区
3. **Phase 3（Week 5-6）：** 视觉增强 → Force Action → 监控图表 → 性能优化

详细的 Milestone 任务表和验收标准见 `openspec/project.md`。

## 测试要求

- `store/` 和 `gateway/event-parser.ts` **必须**有单元测试
- 组件使用 `@testing-library/react` 测试关键交互
- 不要求高覆盖率，但关键数据流必须有测试

## Git 约定

- 提交信息使用 Conventional Commits 格式（中英均可）
- 每个 Milestone 结束时做一次 tag（如 `v0.1.0-phase1`）
- 不提交 `.env` 文件、node_modules、dist 目录
