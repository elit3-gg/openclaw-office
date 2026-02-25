# Phase 3: 3D 增强 + 高级交互

> 工期: Week 5-6 (Day 15-21)
> 前置: Phase 2 全部完成
> 目标: 提升视觉品质、增加管理员操作能力、优化性能

---

## M3.1 视觉增强（Day 15-17）

### 任务

1. **GLTF 模型引入**

- 寻找并引入低多边形风格的免费 GLTF 模型：
  - 办公桌（替换 BoxGeometry）
  - 办公椅
  - 电脑屏幕
  - 咖啡杯（休息区装饰）
- 模型来源建议：Kenney.nl (CC0)、Poly Pizza、Sketchfab (CC-BY)
- 使用 drei 的 `useGLTF` 加载
- 放置在 `public/models/` 目录

2. **后处理特效**

```bash
pnpm add @react-three/postprocessing
```

- Bloom：应用于协作连线和状态特效，`intensity={1.5}`
- SSAO（可选）：增加空间感，低强度
- 注意性能影响，提供关闭开关

3. **日/夜模式**

- 亮色模式（日间）：
  - 暖色方向光（强度 1.2）
  - 浅蓝天空背景
  - UI 使用浅色主题
- 暗色模式（夜间）：
  - 冷色方向光（强度 0.4）+ 点光源（模拟台灯）
  - 深蓝/近黑天空
  - UI 使用深色主题（当前默认）
- 跟随 store.theme 切换，带平滑过渡

4. **SkillHologram.tsx** — 全息工具面板

Agent 进入 `tool_calling` 状态时：
- 面前 45 度角弹出半透明的平面
- 上面显示工具图标 + 工具名称
- 下方进度条动画
- 工具完成时显示绿色对勾后消失

5. **Avatar 增强**

- 从简单的圆形首字母升级为生成式 SVG 头像
- 基于 agentId hash 确定：脸型轮廓、发型、颜色
- 在 AgentDetailPanel 和 Sidebar 中使用

### 验收标准

- [ ] GLTF 模型正确加载并替换了 BoxGeometry
- [ ] Bloom 效果在连线和特效上生效
- [ ] 日/夜模式切换平滑
- [ ] 全息工具面板正确显示当前工具信息
- [ ] Avatar 更丰富、更有辨识度

---

## M3.2 Force Action 干预（Day 17-18）

### 任务

1. **上下文菜单**

点击 3D 角色或 2D 圆点时弹出菜单：
- Pause Agent — 暂停当前 run
- Resume Agent — 恢复暂停的 Agent
- Kill Agent — 终止当前 run
- Send Message — 向 Agent 发送文本指令
- View Session — 跳转到会话详情

2. **ForceActionDialog.tsx**

弹窗组件：
- Send Message 模式：文本输入框 + 发送按钮
- Kill 模式：确认弹窗（"确定要终止 Agent-X 的当前运行吗？"）
- 显示操作对象的 Agent 信息

3. **RPC 集成**

- 操作通过 Gateway RPC 执行
- 如 Gateway 已有 `exec.approval.requested/resolved` 机制，复用之
- 如需新增 RPC，在前端定义接口，后端待实现
- 操作前检查 `connectionStatus === "connected"`

4. **权限校验**

- Force Action 需要 `operator` scope
- 连接时的 `scopes` 参数决定权限
- 无权限时按钮灰色 + tooltip 说明
- 有权限时操作前二次确认

### 验收标准

- [ ] 点击 Agent 弹出上下文菜单
- [ ] Send Message 弹窗可输入文本
- [ ] Kill 操作有二次确认
- [ ] 无权限时操作按钮被禁用
- [ ] （如 Gateway 支持）操作可实际执行

---

## M3.3 监控面板增强（Day 18-20）

### 任务

1. **Token 消耗折线图**

使用 Recharts：
- X 轴：时间（最近 30 分钟，1 分钟粒度）
- Y 轴：tokens/min
- 多条线：总量 + 各 Agent 分别的消耗
- 数据来源：周期性 RPC 调用 `usage.status`

2. **NetworkGraph.tsx** — Agent 关系拓扑图

力导向图（可使用 d3-force 或简单的自定义实现）：
- 节点 = Agent（大小表示活跃度）
- 边 = CollaborationLink（粗细表示 strength）
- 节点颜色 = Agent 状态色
- 可拖拽交互
- 参考设计图4 的 Network Graph 区域

3. **活跃热力图**

日历格子形式：
- 行 = Agent
- 列 = 时间段（最近 24 小时，每小时一格）
- 格子颜色深浅 = 该时段的活跃度
- 参考设计图4 的 Activity Heatmap

4. **成本饼图**

Recharts PieChart：
- 各 Agent 的 token 成本占比
- 悬停显示具体数值
- 数据来源：RPC `usage.cost`

### 验收标准

- [ ] Token 消耗折线图实时更新
- [ ] 网络拓扑图正确展示 Agent 关系
- [ ] 热力图展示 24 小时活跃度分布
- [ ] 成本饼图准确反映各 Agent 占比

---

## M3.4 性能优化 + 收尾（Day 20-21）

### 任务

1. **InstancedMesh 优化**

当 Agent 数量 > 20 时：
- 使用 InstancedMesh 批量渲染角色的身体部分
- 保持每个角色的材质颜色独立（通过 instance color 属性）
- 头部和特效仍然独立渲染

2. **LOD 系统**

基于相机距离：
- 近距（zoom > 80）：完整角色 + 气泡 + 特效
- 中距（zoom 40-80）：简化角色 + 状态色点
- 远距（zoom < 40）：仅状态色点（类似 2D 模式）

3. **代码分割**

- R3F 相关代码使用 `React.lazy` + `Suspense` 懒加载
- 2D 模式下不加载 Three.js bundle
- 图表组件按需加载

4. **响应式适配**

- 检测屏幕宽度 < 768px → 自动切换为 2D 模式
- 侧栏在小屏幕下可折叠为底部抽屉
- 面板适配移动端布局

5. **文档完善**

- 更新 README.md（最终版使用说明）
- 确认所有 openspec 文档与实际实现一致
- 添加部署指南（`pnpm build` → dist/ → 静态托管）

6. **E2E 测试**

关键流程测试：
- 应用启动 → Mock 模式正常
- Agent 事件到达 → UI 更新
- 2D ↔ 3D 切换
- Agent 选中 → 详情面板显示
- （如有 Gateway）真实连接 → 数据流正常

### 验收标准

- [ ] 50 个 Agent 场景下 3D 帧率 ≥ 24fps
- [ ] 2D 模式不加载 Three.js（检查 bundle 分析）
- [ ] 小屏幕自动适配为 2D + 底部抽屉布局
- [ ] 所有文档更新完成
- [ ] 关键流程测试通过

---

## Phase 3 完成标志

Phase 3 完成后，OpenClaw Office v1.0 应具备：

1. 完整的 2D + 3D 双模式办公室可视化
2. 实时的 Agent 状态、工具调用、文本输出展示
3. Sub-Agent 生命周期的动态可视化
4. 会议区自动聚集交互
5. Force Action 干预能力
6. Token/Cost 监控面板
7. Agent 关系拓扑图
8. 良好的性能（50 Agent 可用）
9. 响应式适配
10. 完整的文档和测试
