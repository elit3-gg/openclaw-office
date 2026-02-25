# OpenClaw Office

> 将 AI 智能体的协作逻辑具象化为实时的数字孪生办公室。

**OpenClaw Office** 是 [OpenClaw](https://github.com/openclaw/openclaw) Multi-Agent 系统的可视化监控前端。它通过 Isometric 风格的虚拟办公室场景，实时展示 Agent 的工作状态、协作链路、工具调用和资源消耗。

**核心隐喻：** Agent = 数字员工 | 办公室 = Agent 运行时 | 工位 = Session | 会议室 = 协作上下文

---

## 功能概览

### 虚拟办公室

- **固定工位 (Permanent Desks)：** 对应常驻 Agent（如 CEO-Agent、Dev-Agent），展示长期运行状态
- **动态工位 (Hot Desks)：** 为 Sub-Agent（临时工）设计，任务触发时闪现，完成后消失
- **会议中心 (Meeting Pods)：** 多 Agent 协作时自动聚集，展示联合任务流

### 实时状态感知

- **思维气泡 (Thinking Bubbles)：** 实时流式展示 Agent 正在生成的文本内容
- **技能面板 (Skill Panels)：** Agent 调用工具时弹出对应的操作面板
- **协作连线 (Collaboration Links)：** Agent 间消息传递的可视化连线

### 监控与干预

- **Token 仪表盘：** 实时展示全局 Token 消耗速率及各 Agent 贡献度
- **Force Action：** 点击 Agent 可弹出指令面板，直接干预下一步决策

---

## 技术栈

| 层 | 技术 |
|-----|------|
| 构建工具 | Vite 6 |
| UI 框架 | React 19 |
| 2D 渲染 | SVG + CSS Animations |
| 2.5D/3D 渲染 | React Three Fiber (R3F) |
| 状态管理 | Zustand 5 |
| 样式 | Tailwind CSS 4 |
| 图表 | Recharts |
| 实时通信 | 原生 WebSocket（对接 OpenClaw Gateway） |

---

## 快速开始

### 环境要求

- Node.js 22+
- pnpm
- 运行中的 [OpenClaw Gateway](https://github.com/openclaw/openclaw)

### 安装与启动

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

### 配置

复制 `.env.example` 为 `.env`，填入你的 Gateway 地址：

```bash
cp .env.example .env
```

```
VITE_GATEWAY_URL=ws://localhost:18789
```

如需在没有 Gateway 的情况下开发，启用 Mock 模式：

```
VITE_MOCK=true
```

---

## 项目结构

```
OpenClaw-Office/
├── src/
│   ├── main.tsx                     # 入口
│   ├── App.tsx                      # 根组件
│   ├── gateway/                     # Gateway 通信层
│   │   ├── ws-client.ts            # WebSocket 客户端 + 认证 + 重连
│   │   ├── rpc-client.ts           # RPC 请求封装
│   │   ├── event-parser.ts         # 事件解析 + 状态映射
│   │   └── types.ts                # Gateway 协议类型
│   ├── store/                       # Zustand 状态管理
│   │   ├── office-store.ts         # 主 Store
│   │   ├── agent-reducer.ts        # Agent CRUD + 状态转换
│   │   └── metrics-reducer.ts      # 指标聚合
│   ├── components/
│   │   ├── layout/                 # 页面布局（AppShell、Sidebar、TopBar）
│   │   ├── office-2d/              # Phase 1: 2D SVG 平面图
│   │   ├── office-3d/              # Phase 2: R3F 3D 场景
│   │   ├── overlays/               # HTML Overlay（气泡、状态、面板）
│   │   ├── panels/                 # 侧边/弹窗面板
│   │   └── shared/                 # 公共组件
│   ├── hooks/                       # 自定义 Hooks
│   ├── lib/                         # 工具库
│   └── styles/                      # 全局样式
├── public/
│   ├── models/                      # GLTF/GLB 3D 模型（Phase 2+）
│   └── icons/                       # 工具/Skill 图标
├── tests/                           # 测试文件
├── openspec/                        # 项目规格文档
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 开发路线图

| 阶段 | 内容 | 目标 |
|------|------|------|
| Phase 1 (Week 1-2) | 基础框架 + 2D SVG 平面图 | 最小可用产品 |
| Phase 2 (Week 3-4) | Isometric 2.5D 办公室 + Sub-Agent 可视化 | 核心体验 |
| Phase 3 (Week 5-6) | 3D 增强 + Force Action + 监控面板 | 完整愿景 |

详细规划见 `openspec/project.md`。

---

## 与 OpenClaw Gateway 的关系

本项目通过 WebSocket 连接 OpenClaw Gateway，消费以下实时数据：

- **Agent 生命周期事件** — `lifecycle` stream（start/end/error）
- **工具调用事件** — `tool` stream（工具名、参数、结果）
- **文本输出事件** — `assistant` stream（Markdown 文本流）
- **Sub-Agent 事件** — 派生/结束生命周期
- **RPC 数据** — `agents.list`、`usage.status`、`sessions.list` 等

---

## 贡献

欢迎任何关于 3D 模型优化、新的可视化效果或性能改进的贡献。

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/cool-effect`)
3. 提交更改
4. 开启 Pull Request

---

## 许可证

MIT
