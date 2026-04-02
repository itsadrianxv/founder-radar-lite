# AGENTS

本文件记录当前仓库在真实环境中的使用方式，帮助后续 agent 或维护者不要重复踩坑。

## 当前环境

- 本地开发机：Windows
- 本地仓库路径：`D:\课外项目\ai-builders-sync`
- GitHub 私有仓库：`https://github.com/itsadrianxv/founder-radar-lite`
- 服务器：阿里云 Ubuntu
- 服务器登录用户：`admin`
- 服务器部署路径：`/home/admin/apps/founder-radar-lite`

## 当前标准生产方案

当前推荐的标准生产链路是：

1. 在阿里云服务器上常驻 `OpenClaw Gateway`
2. 用 `OpenClaw cron` 定时触发本仓库 skill
3. skill 运行 `node src/cli.js deliver`
4. 仓库脚本直接调用 Lark 官方 API，把深度日报分 3–5 条富文本消息发到飞书
5. `OpenClaw` 只负责调度与状态回报，不再直接转发原始 Markdown 正文

这样做的原因是：

- 仍然保留 OpenClaw 在调度上的便利
- 把最终正文发送收回仓库脚本，避免飞书里出现难看的原始 Markdown
- 便于在仓库内统一控制摘要深度、分段策略和发送格式

## 生产所需环境变量

服务器上至少需要：

- `FOLLOW_BUILDERS_FEED_BASE_URL`
- `FOUNDER_RADAR_LANGUAGE`
- `FOUNDER_RADAR_LLM_BASE_URL`
- `FOUNDER_RADAR_LLM_API_KEY`
- `FOUNDER_RADAR_LLM_MODEL`
- `LARK_APP_ID`
- `LARK_APP_SECRET`
- `LARK_RECIPIENT_OPEN_ID`

推荐值示例：

```bash
export FOLLOW_BUILDERS_FEED_BASE_URL="https://raw.githubusercontent.com/zarazhangrui/follow-builders/main"
export FOUNDER_RADAR_LANGUAGE="zh-CN"
export FOUNDER_RADAR_LLM_BASE_URL="https://api.deepseek.com/v1"
export FOUNDER_RADAR_LLM_API_KEY="your_api_key"
export FOUNDER_RADAR_LLM_MODEL="deepseek-reasoner"
export LARK_APP_ID="cli_your_app_id"
export LARK_APP_SECRET="your_app_secret"
export LARK_RECIPIENT_OPEN_ID="ou_your_open_id"
```

不要把真实 secret 直接写进仓库。

## 服务器侧手动验证顺序

每次部署后，推荐按这个顺序验证：

### 1. 拉取最新代码

```bash
cd /home/admin/apps/founder-radar-lite
git pull
```

### 2. 运行测试

```bash
npm test
```

### 3. 验证日报预览

```bash
node src/cli.js run
```

### 4. 验证真实投递

```bash
node src/cli.js deliver
```

### 5. 验证 OpenClaw 调度链路

手动触发一次对应的 `OpenClaw cron`，确认飞书能收到精排后的 3–5 条中文深度消息。

## 推荐自动化方式

推荐仍然使用 `OpenClaw cron`，而不是系统 `crontab` 直接发正文。
`scripts/run-and-send.sh` 作为统一入口，内部只调用 `node src/cli.js deliver`。

## 本地修改后如何部署

### 本地

1. 必须先创建独立 git worktree
2. 在 worktree 中修改
3. 本地验证
4. 提交到功能分支
5. 合并到 `main`
6. 推送 `origin/main`
7. 清理功能 worktree 和分支

### 服务器

1. `cd /home/admin/apps/founder-radar-lite`
2. `git pull`
3. `npm test`
4. 运行 `node src/cli.js deliver`
5. 如需验证调度，再手动触发一次 OpenClaw cron
6. 若改动涉及环境变量，更新服务器环境或 `.env`

## 关于 OpenClaw

OpenClaw 当前在本项目里的角色是：

- **负责调度**
- **负责状态回报**
- **不负责直接转发日报正文**

如果未来重新切回“OpenClaw 直接发送正文”的路线，需要重新确认：

- 飞书渲染能力是否满足排版要求
- cron 执行时的 approval / memory / identity 行为是否可控
- 是否还能保证最终收到的是精排内容而不是原始 Markdown

## 文档入口

- OpenClaw 调度说明：`docs/openclaw-lark-setup.md`
- 仓库内飞书投递说明：`docs/direct-lark-api-setup.md`
- 初始化踩坑记录：`docs/learnt/initial_setup.md`
