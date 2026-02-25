# Phase 2: Isometric 2.5D 办公室

> 工期: Week 3-4 (Day 8-14)
> 前置: Phase 1 全部完成
> 目标: 升级为 isometric 2.5D 场景，增加 Sub-Agent 可视化和会议区

---

## M2.1 R3F 基础场景（Day 8-10）

### 任务

1. **安装依赖**

```bash
pnpm add three @react-three/fiber @react-three/drei
pnpm add -D @types/three
```

2. **Scene.tsx** — R3F Canvas 容器

```tsx
<Canvas orthographic camera={{ position: [10, 10, 10], zoom: 50 }}>
  <Environment />
  <OfficeLayout />
  {/* Agent 角色渲染 */}
  <OrbitControls enableRotate={false} enablePan enableZoom />
</Canvas>
```

- 使用 OrthographicCamera 实现 isometric 视角
- 禁用旋转（保持 isometric 角度），允许平移和缩放
- 抗锯齿开启

3. **Environment.tsx** — 场景环境

- 方向光（模拟日光）+ 环境光
- 地板：PlaneGeometry 旋转 -π/2，灰色材质
- 网格线：drei 的 `<Grid>` 组件，辅助对齐
- 可选：简单天空背景色

4. **OfficeLayout.tsx** — 工位布局

- 使用 BoxGeometry 创建桌子和椅子（临时模型，Phase 3 替换为 GLTF）
- 桌子：长方体 2x0.1x1，灰白色
- 椅子：小立方体 0.4x0.5x0.4，深灰色
- 按 Desk Zone / Meeting Zone / Hot Desk Zone 排列
- 区域用半透明彩色平面标识

5. **模式切换 UI**

- 顶栏添加 2D/3D 切换按钮
- 2D 模式渲染 Phase 1 的 SVG FloorPlan
- 3D 模式渲染 R3F Scene
- 切换时平滑过渡（fade in/out）

### 验收标准

- [ ] R3F Canvas 正常渲染，可看到 isometric 视角的办公室
- [ ] 桌椅模型在正确的位置
- [ ] 可平移和缩放，不可旋转
- [ ] 2D ↔ 3D 切换按钮工作正常

---

## M2.2 Agent 角色系统（Day 10-12）

### 任务

1. **AgentCharacter.tsx** — 3D 角色

几何体组成：
- 身体：CapsuleGeometry (radius=0.2, height=0.6)
- 头部：SphereGeometry (radius=0.15)，位于身体上方
- 材质：MeshStandardMaterial，颜色由 avatar-generator 决定

2. **avatar-generator.ts 增强**

基于 agentId 生成：
- 主题色（从预设的 12 色调色板中选取）
- 衣服色（主题色的变体）
- Sub-Agent 使用蓝色系 + 半透明

3. **状态动画**（使用 `useFrame` hook）

| 状态 | 动画 |
|------|------|
| `idle` | 身体 Y 轴微小 sin 波位移（呼吸感） |
| `thinking` | 头顶出现旋转的 Torus（加载圈） |
| `tool_calling` | 面前浮现半透明的 PlaneGeometry（虚拟屏幕） |
| `speaking` | drei `<Html>` 组件渲染 SpeechBubble |
| `error` | 头顶红色八面体缓慢旋转 |

4. **Sub-Agent 外观区分**

- `MeshStandardMaterial` 设置 `transparent: true, opacity: 0.6`
- 边缘发光效果（可选，使用简单的 scale 脉冲动画模拟）
- 颜色偏向蓝色调

5. **3D 工位分配**

复用 Phase 1 的 `position-allocator.ts`，将 2D 坐标映射到 3D：
- 2D (x, y) → 3D (x * scale, 0, y * scale)

6. **HTML Overlay**

使用 drei 的 `<Html>` 组件将 Phase 1 的 SpeechBubble、StatusBadge 嵌入 3D 场景：
- `distanceFactor={10}` 控制缩放
- `occlude` 属性处理遮挡

### 验收标准

- [ ] 每个 Agent 在 3D 场景中显示为胶囊体+球头角色
- [ ] 同一 Agent 每次打开页面颜色相同（确定性）
- [ ] 各状态动画正确播放
- [ ] Sub-Agent 明显区别于常驻 Agent（半透明蓝色）
- [ ] 头顶气泡和状态标识正常显示

---

## M2.3 Sub-Agent 生命周期可视化（Day 12-13）

### 任务

1. **事件源确认**

检查 Gateway 是否通过 WS 广播 `subagent_spawned` / `subagent_ended` 事件。
- 如已广播：直接消费
- 如未广播：通过 RPC 轮询 `sessions.list` 检测 Sub-Agent 变化（每 3s）

2. **SpawnPortal.tsx** — 派生特效

当 Sub-Agent 生成时：
- 父 Agent 位置闪现光环（3 个同心 RingGeometry 旋转 + 缩放动画）
- 新工位位置出现由小到大的角色（scale 0→1，duration 800ms）
- 父到子的光束连线

3. **消失动画**

Sub-Agent 结束时根据 `endedReason`：
- `complete` → 绿色粒子消散（scale 1→0 + 向上移动）
- `error` → 红色闪烁后消失
- `killed` → 快速缩小消失
- 动画 duration 800ms，结束后从 store 移除

4. **父子连线**

- 使用 drei `<Line>` 组件
- 虚线样式 `dashed dashScale={2}`
- 颜色随 Sub-Agent 状态变化

5. **Sub-Agent 面板**

新增面板 `SubAgentListPanel.tsx`：
- 列出所有活跃的 Sub-Agent
- 显示：名称、parent、task、状态、已运行时长
- 可点击跳转到对应位置

### 验收标准

- [ ] Sub-Agent 出现时有明显的生成动画
- [ ] Sub-Agent 消失时动画与结束原因对应
- [ ] 父 Agent 和子 Agent 之间有可见的连线
- [ ] 面板正确列出所有活跃的 Sub-Agent

---

## M2.4 会议区交互（Day 13-14）

### 任务

1. **协作检测逻辑**

在 `agent-reducer.ts` 中：
- 维护 `CollaborationLink[]`
- 当 2+ Agent 的 `assistant` 事件的 `sessionKey` 相关时，建立 link
- link 的 `strength` 基于最近 30s 内的消息频率

2. **自动聚集**

当 2+ Agent 有活跃协作时：
- 自动将它们的位置移动到 Meeting Zone（带平滑过渡动画）
- 围坐在会议桌旁

3. **会议桌模型**

- 圆桌：CylinderGeometry (radius=1.5, height=0.1)
- 椅子：沿圆桌等角分布
- 桌面上方 HTML overlay 显示协作任务名称

4. **底部操作栏**

会议模式下在视口底部显示操作按钮：
- Pause Agent — 暂停选中的 Agent
- Spawn Sub-Agent — 手动触发派生
- Interview — 向 Agent 发送消息

（Phase 1-2 这些按钮仅做 UI，实际功能在 Phase 3 的 Force Action 中实现）

### 验收标准

- [ ] 有协作关系的 Agent 自动移动到会议区
- [ ] 会议桌上显示协作任务标签
- [ ] 协作结束后 Agent 返回原位
- [ ] 底部操作栏正确显示（按钮可点击但 Phase 2 暂不执行实际操作）
