# Gateway 协议参考

> 本文档从 OpenClaw 主项目源码中提取关键协议定义，供前端开发参考。
> 权威定义位于主项目的 `src/gateway/protocol/` 目录。

---

## 一、WebSocket 帧格式

### 客户端 → Gateway（请求）

```typescript
type GatewayRequest = {
  type: "req";
  id: string;      // 请求 ID，用 crypto.randomUUID()
  method: string;   // 方法名，如 "connect", "agents.list"
  params?: unknown;  // 方法参数
};
```

### Gateway → 客户端（响应）

```typescript
type GatewayResponse = {
  type: "res";
  id: string;       // 对应请求的 ID
  result?: unknown;  // 成功时的结果
  error?: {          // 失败时的错误
    code: number;
    message: string;
  };
};
```

### Gateway → 客户端（事件广播）

```typescript
type GatewayEventFrame = {
  type: "event";
  event: string;     // 事件名，如 "agent", "presence", "health"
  payload: unknown;  // 事件数据
  seq?: number;      // 序列号
  stateVersion?: number;
};
```

---

## 二、连接认证

### 1. Gateway 发起 Challenge

连接建立后，Gateway 立即发送：

```json
{
  "type": "event",
  "event": "connect.challenge",
  "payload": { "nonce": "random-nonce-string" }
}
```

### 2. 客户端发送 Connect 请求

```json
{
  "type": "req",
  "id": "uuid-xxx",
  "method": "connect",
  "params": {
    "minProtocol": 1,
    "maxProtocol": 1,
    "client": {
      "id": "office-viz",
      "displayName": "OpenClaw Office",
      "version": "0.1.0",
      "platform": "web",
      "mode": "companion"
    },
    "caps": ["tool-events"],
    "auth": {
      "token": "pairing-token-here"
    }
  }
}
```

### ConnectParams 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `minProtocol` | number | 最低支持的协议版本，设 1 |
| `maxProtocol` | number | 最高支持的协议版本，设 1 |
| `client.id` | string | 客户端唯一标识 |
| `client.displayName` | string | 显示名称（可选） |
| `client.version` | string | 客户端版本号 |
| `client.platform` | string | 平台，web/macos/linux/windows |
| `client.mode` | string | 模式：`companion` / `operator` / `node` |
| `caps` | string[] | 请求的能力，`tool-events` 表示接收工具事件 |
| `auth.token` | string | 配对令牌 |

### 3. Gateway 返回

成功：
```json
{
  "type": "res",
  "id": "uuid-xxx",
  "result": { "protocol": 1, "connId": "conn-123" }
}
```

同时广播 `connect.accepted` 事件。

---

## 三、Agent 事件

### AgentEventPayload

所有 Agent 相关事件通过 `event: "agent"` 广播，payload 格式：

```typescript
type AgentEventPayload = {
  runId: string;        // Agent 运行实例 ID
  seq: number;          // 单调递增的序列号（每个 runId 独立计数）
  stream: AgentEventStream; // 事件类型
  ts: number;           // 时间戳（毫秒）
  data: Record<string, unknown>; // 事件数据
  sessionKey?: string;  // 关联的会话
};

type AgentEventStream =
  | "lifecycle"    // 生命周期事件（start/end/error）
  | "tool"         // 工具调用事件
  | "assistant"    // 文本输出事件
  | "error"        // 错误事件
  | string;        // 扩展类型
```

### Lifecycle Stream

```json
// Agent 运行开始
{ "stream": "lifecycle", "data": { "phase": "start" } }

// Agent 正在思考
{ "stream": "lifecycle", "data": { "phase": "thinking" } }

// Agent 运行结束
{ "stream": "lifecycle", "data": { "phase": "end" } }

// Agent 运行出错并回退
{ "stream": "lifecycle", "data": { "phase": "fallback" } }
```

### Tool Stream

```json
// 开始调用工具
{
  "stream": "tool",
  "data": {
    "name": "browser_search",
    "args": { "query": "OpenClaw docs" }
  }
}

// 工具返回结果（需 tool-events capability）
{
  "stream": "tool",
  "data": {
    "name": "browser_search",
    "result": { "urls": ["..."] }
  }
}
```

### Assistant Stream

```json
// 文本输出（流式，多次推送）
{
  "stream": "assistant",
  "data": {
    "text": "根据搜索结果，我发现..."
  }
}
```

### Error Stream

```json
{
  "stream": "error",
  "data": {
    "message": "Rate limit exceeded",
    "code": "rate_limit"
  }
}
```

---

## 四、Sub-Agent 生命周期

### 类型定义

```typescript
// 来自 src/agents/subagent-spawn.ts
type SpawnSubagentParams = {
  task: string;
  label?: string;
  agentId?: string;
  model?: string;
  thinking?: string;
  runTimeoutSeconds?: number;
  thread?: boolean;
  mode?: "run" | "session";
  cleanup?: "delete" | "keep";
};

type SpawnSubagentResult = {
  status: "accepted" | "forbidden" | "error";
  childSessionKey?: string;
  runId?: string;
  mode?: "run" | "session";
  error?: string;
};
```

### 生命周期结束原因

```typescript
// 来自 src/agents/subagent-lifecycle-events.ts
type SubagentLifecycleEndedReason =
  | "subagent-complete"  // 正常完成
  | "subagent-error"     // 出错
  | "subagent-killed"    // 被终止
  | "session-reset"      // 会话重置
  | "session-delete";    // 会话删除

type SubagentLifecycleEndedOutcome =
  | "ok" | "error" | "timeout" | "killed" | "reset" | "deleted";
```

### 运行记录

```typescript
// 来自 src/agents/subagent-registry.types.ts
type SubagentRunRecord = {
  runId: string;
  childSessionKey: string;
  requesterSessionKey: string; // 父 Agent 的 session
  task: string;
  label?: string;
  model?: string;
  spawnMode?: "run" | "session";
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  outcome?: SubagentRunOutcome;
  endedReason?: SubagentLifecycleEndedReason;
};
```

### Plugin Hooks（Gateway 端）

| Hook | 触发时机 |
|------|---------|
| `subagent_spawning` | Sub-Agent 即将生成 |
| `subagent_spawned` | Sub-Agent 已生成 |
| `subagent_ended` | Sub-Agent 运行结束 |

**注意：** 这些 hook 在 Gateway 进程内触发。是否通过 WebSocket 广播到客户端，需要确认 Gateway 的实际行为。如未广播，前端需通过 RPC 轮询 `sessions.list` 来检测 Sub-Agent 状态变化。

---

## 五、可用 RPC 方法

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `connect` | `ConnectParams` | `{ protocol, connId }` | 认证连接 |
| `agents.list` | `{}` | `AgentConfig[]` | Agent 配置列表 |
| `sessions.list` | `{ agentId? }` | `SessionPreview[]` | 会话列表 |
| `sessions.preview` | `{ sessionKey }` | `SessionDetail` | 会话详情 |
| `sessions.usage` | `{ sessionKey }` | `UsageData` | 会话用量 |
| `usage.status` | `{}` | `UsageStatus` | 全局用量统计 |
| `usage.cost` | `{}` | `CostData` | 成本统计 |
| `tools.catalog` | `{}` | `ToolDef[]` | 工具目录 |
| `health` | `{}` | `HealthSnapshot` | 系统健康 |
| `models.list` | `{}` | `ModelInfo[]` | 可用模型列表 |

---

## 六、广播事件列表

| 事件 | Payload | 说明 |
|------|---------|------|
| `connect.challenge` | `{ nonce }` | 认证挑战 |
| `agent` | `AgentEventPayload` | Agent 生命周期/工具/文本/错误 |
| `chat` | 消息数据 | 聊天消息 |
| `presence` | 在线列表 | 连接的客户端/设备 |
| `health` | 健康快照 | 系统健康 |
| `heartbeat` | 心跳数据 | 定期心跳 |
| `tick` | 维护数据 | 维护计时器 |
| `cron` | 任务数据 | 定时任务事件 |
| `shutdown` | `{ reason }` | Gateway 关闭 |
| `update.available` | 版本信息 | 可用更新 |
