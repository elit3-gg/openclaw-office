# OpenSpec — Agent 开发指南

本目录包含 OpenClaw Office 项目的完整规格文档（OpenSpec），用于指导 AI Agent（Codex 等）进行实际开发。

## 目录结构

```
openspec/
├── AGENTS.md            # 本文件 — OpenSpec 使用指南
├── project.md           # 项目总览与技术蓝图
├── tasks.md             # 任务追踪表（所有 Milestone 的进度）
├── phases/
│   ├── phase-1.md       # Phase 1 详细开发 Spec
│   ├── phase-2.md       # Phase 2 详细开发 Spec
│   └── phase-3.md       # Phase 3 详细开发 Spec
└── gateway-protocol.md  # Gateway 协议参考（从主项目提取的关键类型）
```

## 开发流程

### 接到任务时

1. 先读 `project.md` 了解项目全貌
2. 读 `tasks.md` 了解当前进度，找到下一个未完成的 Milestone
3. 读对应 `phases/phase-N.md` 获取详细的任务列表和验收标准
4. 如需了解 Gateway 协议细节，读 `gateway-protocol.md`

### 完成任务时

1. 更新 `tasks.md`，勾选已完成的任务
2. 如实际实现与 Spec 不同，更新对应的 phase 文档
3. 编写简要的变更说明

### 核心原则

- **严格按 Milestone 顺序执行**：每个 Milestone 的验收标准全部通过后，才进入下一个
- **先理解再动手**：每次开始新 Milestone 前，完整阅读对应的 Spec
- **Mock 优先**：Phase 1 的 WS 客户端开发时，同步实现 Mock 模式，确保无 Gateway 也能开发 UI
- **测试关键路径**：store 和 event-parser 必须有测试，组件测试覆盖核心交互
- **文件精简**：单文件不超过 500 行，组件 PascalCase，hook useCamelCase

## 技术约束

- TypeScript strict，不用 `any`
- React 19 + Vite 6 + Tailwind 4
- Zustand 5 + Immer 中间件
- 原生 WebSocket（不用 Socket.io）
- Phase 2+ 才引入 R3F（Phase 1 纯 2D）
