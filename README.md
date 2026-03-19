# QQ Classic Farm Mobile

QQ 经典农场移动端复刻项目，采用 npm workspace 单仓库结构：
- `apps/web`：React + Vite 移动端前端
- `apps/server`：Node.js + Fastify + WebSocket 实时服务
- `packages/protocol`：前后端共享协议
- `packages/config`：共享规则与种子配置

## 环境要求

- Node.js 22+
- npm 10+
- Windows / macOS / Linux

## 安装

```bash
npm install
```

## 本地开发

启动服务端：

```bash
npm run dev:server
```

启动前端：

```bash
npm run dev:web
```

默认情况下：
- 服务端地址：`http://127.0.0.1:3000`
- 前端开发地址：`http://127.0.0.1:5173`
- SQLite 文件：`data/server.sqlite`

可用环境变量：
- `HOST`
- `PORT`
- `DATABASE_PATH`
- `AUTH_SECRET`
- `TEST_MODE=1`：开启仅用于 e2e 的测试辅助路由

## 测试

运行单元测试：

```bash
npm test -- --pool threads
```

运行 Playwright e2e：

```bash
npm run test:e2e
```

当前 e2e 会自动：
- 启动前端开发服务器
- 启动服务端并注入 `TEST_MODE=1`
- 使用 `tests/e2e` 中的移动端场景

## 构建

构建全部工作区：

```bash
npm run build
```

分别构建：

```bash
npm run build -w @qq-classic-farm/server
npm run build -w @qq-classic-farm/web
```

## 数据与实时同步

- 所有游戏状态以服务端为准
- 客户端通过 WebSocket 请求/响应获取数据并同步操作结果
- 持久化使用 SQLite
- 注册用户后会自动初始化农场、地块与基础物品
