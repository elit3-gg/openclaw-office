# OpenClaw Office — 任务追踪

> 最后更新: 2026-02-25

## Phase 1: 基础框架 + 2D 平面图（Week 1-2）

### M1.1 项目脚手架（Day 1-2）

- [x] 初始化 Vite + React + TypeScript 项目
- [x] 创建目录结构（gateway/ store/ components/ hooks/ lib/）
- [x] 配置 package.json（依赖声明）
- [x] 配置 tsconfig.json
- [x] 配置 vite.config.ts（含 proxy 和 path alias）
- [x] 创建 index.html 入口
- [x] 创建 main.tsx + App.tsx 骨架
- [x] 创建 .env.example
- [ ] 安装依赖（pnpm install）
- [ ] 配置 Tailwind CSS 4（@tailwindcss/vite 插件）
- [ ] 验证 `pnpm dev` 可启动并渲染 App
- [ ] 创建 AppShell 布局组件（顶栏 + 侧栏 + 主区域）
- [ ] 配置 Vitest 测试环境

### M1.2 Gateway WebSocket 客户端（Day 2-3）

- [ ] 实现 WebSocket 连接管理（ws-client.ts）
- [ ] 实现 connect.challenge 认证流程
- [ ] 实现自动重连（指数退避 1s→30s）
- [ ] 实现 RPC 请求/响应封装（rpc-client.ts）
- [ ] 实现事件解析器（event-parser.ts）
- [ ] 实现 Gateway 协议类型定义（types.ts）
- [ ] 实现 Mock 模式 provider（mock-provider.ts）
- [ ] 实现 useGatewayConnection hook
- [ ] 连接状态 UI 指示器（TopBar 中）

### M1.3 Zustand Store + 事件驱动更新（Day 3-4）

- [ ] 定义 VisualAgent / OfficeStore 类型
- [ ] 实现 office-store.ts（Zustand + Immer）
- [ ] 实现 agent-reducer.ts（事件到状态映射）
- [ ] 实现 metrics-reducer.ts（指标聚合）
- [ ] 实现事件批处理（event-throttle.ts）
- [ ] 初始化时 RPC 拉取 agents.list
- [ ] 编写 office-store 单元测试
- [ ] 编写 event-parser 单元测试

### M1.4 2D SVG 平面图（Day 4-6）

- [ ] 绘制 SVG 办公室平面图（FloorPlan.tsx）
- [ ] 实现区域定义（desk/meeting/hotdesk/lounge）
- [ ] 实现 AgentDot 组件（状态色彩编码圆点）
- [ ] 实现 ConnectionLine 组件（Agent 间虚线连线）
- [ ] 实现 ZoneLabel 组件（区域标签）
- [ ] 实现工位分配算法（position-allocator.ts）
- [ ] 实现 SpeechBubble 组件（Markdown 气泡）
- [ ] 实现 StatusBadge 组件
- [ ] 点击 Agent 触发选中状态

### M1.5 右侧面板 + 指标（Day 6-7）

- [ ] 实现 Sidebar（Agent 列表 + 搜索 + 状态过滤）
- [ ] 实现 AgentDetailPanel（name/status/tool/speech）
- [ ] 实现 MetricsPanel（Active Agents / Total Tokens / Heat）
- [ ] 实现 EventTimeline（最近 50 条事件）
- [ ] 实现 ToolIcon 映射组件
- [ ] 实现 Avatar 组件（确定性头像）

---

## Phase 2: Isometric 2.5D 办公室（Week 3-4）

### M2.1 R3F 基础场景（Day 8-10）

- [ ] 安装 R3F 相关依赖（three, @react-three/fiber, drei）
- [ ] 创建 Scene.tsx（Canvas 容器）
- [ ] 配置 OrthographicCamera（isometric 视角）
- [ ] 创建 Environment.tsx（灯光 + 地板 + 网格）
- [ ] 创建 OfficeLayout.tsx（BoxGeometry 工位模型）
- [ ] 实现区域地面标记
- [ ] 实现 2D ↔ 3D 模式切换 UI

### M2.2 Agent 角色系统（Day 10-12）

- [ ] 创建 AgentCharacter.tsx（胶囊体+球头几何体）
- [ ] 实现 avatar-generator.ts（确定性颜色/形状）
- [ ] 实现状态动画（idle/thinking/tool_calling/speaking）
- [ ] 实现 Sub-Agent 半透明外观
- [ ] 实现 3D 空间中的工位分配
- [ ] 使用 drei Html 组件嵌入气泡/面板

### M2.3 Sub-Agent 生命周期可视化（Day 12-13）

- [ ] 实现 SpawnPortal.tsx（传送门特效）
- [ ] 实现 Sub-Agent 消失动画（淡出/缩小）
- [ ] 实现父子 Agent 连线
- [ ] 实现 Sub-Agent 列表面板

### M2.4 会议区交互（Day 13-14）

- [ ] 实现协作检测逻辑（2+ Agent 消息交换 → 会议模式）
- [ ] 实现会议桌模型（圆桌 + 椅子排列）
- [ ] 实现联合任务标签（HTML overlay）
- [ ] 实现底部操作栏（Pause / Spawn / Interview）

---

## Phase 3: 3D 增强 + 高级交互（Week 5-6）

### M3.1 视觉增强（Day 15-17）

- [ ] 引入 GLTF 模型替换 BoxGeometry
- [ ] 添加 Bloom + SSAO 后处理
- [ ] 实现日/夜模式切换
- [ ] 实现 SkillHologram.tsx（全息工具面板）
- [ ] 增强 Avatar 系统（SVG/Canvas 头像）

### M3.2 Force Action 干预（Day 17-18）

- [ ] 实现 Agent 右键/点击上下文菜单
- [ ] 实现 ForceActionDialog.tsx
- [ ] 实现操作确认流程
- [ ] 实现权限校验（operator scope）

### M3.3 监控面板增强（Day 18-20）

- [ ] 实现 Token 消耗折线图（Recharts）
- [ ] 实现 NetworkGraph.tsx（力导向拓扑图）
- [ ] 实现活跃热力图
- [ ] 实现成本饼图

### M3.4 性能优化 + 收尾（Day 20-21）

- [ ] InstancedMesh 批量渲染优化
- [ ] LOD 距离降级系统
- [ ] 3D 模块懒加载（代码分割）
- [ ] 响应式适配（移动端自动切 2D）
- [ ] 完善 README 和使用文档
- [ ] E2E 测试（关键流程）
