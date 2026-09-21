# BrainBot

面向多人科研团队的 Web 智能协作平台，帮助团队把项目背景、任务分工、论文证据、讨论结论和研究进展沉淀为可追溯、可复用的团队知识。

## 项目简介

BrainBot 面向 3～10 人的算法或计算机科研小组，覆盖从项目建立到研究交接的完整协作链路：

`创建项目 → 定义分工 → 组队协作 → 沉淀共享记忆 → 检索与核验文献 → 推进任务 → 汇总交接`

平台强调“草稿与事实分离”：新生成的内容先作为草稿，重要结论经过确认后再进入共享知识；论文与引用保留来源、定位和核验状态，方便团队复查和交接。

## 核心能力

- 项目初始化、成员邀请、角色认领与任务协作
- 工作台、团队通讯、实时事件推送与断线补拉
- 共享记忆、来源追踪、审批晋升与上下文装载
- 文件归档、文本解析、论文检索、文献卡片和引用核验
- 研究方向、实验记录、评审 brief 与项目驾驶舱
- 本地 mock 模式，便于离线演示和开发调试
- Docker Compose 部署、数据库迁移、监控、备份与恢复脚本

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | Vue 3、Vite、Pinia |
| 后端 | Node.js、Express |
| 数据库 | PostgreSQL 15、Prisma |
| 实时通信 | SSE |
| 学术检索 | arXiv、OpenAlex |
| 外部模型 | OpenAI 兼容接口，可配置 DeepSeek 等服务 |
| 部署 | Docker Compose、Caddy、Prometheus、Alertmanager |

## 快速开始

### 使用 Docker Compose

```bash
cp .env.deploy.example .env.deploy
```

编辑 `.env.deploy`，至少设置随机的 `POSTGRES_PASSWORD` 和 `JWT_SECRET`；如需接入真实模型，再填写 `LLM_API_KEY`。

```bash
docker compose --env-file .env.deploy up --build
```

启动后访问 [http://localhost:8080](http://localhost:8080)。停止服务：

```bash
docker compose --env-file .env.deploy down
```

### 本地开发

准备 PostgreSQL 数据库后，分别启动后端和前端：

```bash
cd server
npm ci
cp .env.example .env
npm run generate
npm run migrate:deploy
npm run dev
```

另开终端启动前端：

```bash
cd web
npm ci
npm run dev
```

前端开发服务器默认运行在 [http://localhost:5173](http://localhost:5173)，并将 `/api` 请求代理到 `http://localhost:3001`。

## 目录结构

```text
server/    Express API、Prisma schema、迁移和领域服务
web/       Vue 前端、工作台和科研协作界面
ops/       Caddy、Prometheus、告警与备份配置
video/     Remotion 产品演示视频工程
docs/      项目文档与交付记录
```

## 配置说明

- `.env.example`：本地开发配置模板
- `server/.env.example`：后端配置模板
- `.env.deploy.example`：Docker/部署配置模板

真实密钥只放在本地 `.env` 或 `.env.deploy` 中，不要提交到版本库。

## 开源许可

本项目采用 [MIT License](./LICENSE)。
