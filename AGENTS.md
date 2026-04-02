# AGENTS

本文件记录当前仓库在真实环境中的使用方式，帮助后续 agent 或维护者不要重复踩坑。

## 当前环境

- 本地开发机：Windows
- 本地仓库路径：`D:\课外项目\ai-builders-sync`
- GitHub 私有仓库：`https://github.com/itsadrianxv/founder-radar-lite`
- 服务器：阿里云 Ubuntu
- 服务器登录用户：`admin`
- 服务器部署路径：`/home/admin/apps/founder-radar-lite`

## 当前生产发送方案

当前**生产推荐方案**不是 OpenClaw cron，而是：

1. 在服务器本地运行 `node src/cli.js run`
2. 通过 `node src/send-lark.js` 直接调用 Lark 官方 API 发送
3. 通过 `scripts/run-and-send.sh` 把“生成 + 发送”串起来
4. 用系统 `crontab` 每天定时执行

原因：

- OpenClaw + Lark channel 已经配置过，也能收发消息
- 但 OpenClaw cron 在 Founder Radar 发送场景里触发过多次 approval / elevated / memory / identity 偏航问题
- 直连 Lark API 更稳定、边界更清晰

## 生产所需环境变量

服务器上至少需要：

- `FOLLOW_BUILDERS_FEED_BASE_URL`
- `FOUNDER_RADAR_LANGUAGE`
- `LARK_APP_ID`
- `LARK_APP_SECRET`
- `LARK_RECIPIENT_OPEN_ID`

推荐值示例：

```bash
export FOLLOW_BUILDERS_FEED_BASE_URL="https://raw.githubusercontent.com/zarazhangrui/follow-builders/main"
export FOUNDER_RADAR_LANGUAGE="zh-CN"
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

### 3. 验证日报生成

```bash
node src/cli.js run
```

### 4. 验证直接发送

```bash
printf '# Founder Radar\n\nHello from direct Lark API.' | node src/send-lark.js --to "$LARK_RECIPIENT_OPEN_ID" --stdin
```

### 5. 验证完整链路

```bash
bash ./scripts/run-and-send.sh
```

## 推荐自动化方式

编辑服务器上的 `crontab`：

```cron
0 9 * * * cd /home/admin/apps/founder-radar-lite && /usr/bin/env bash ./scripts/run-and-send.sh >> /tmp/founder-radar-cron.log 2>&1
```

这就是当前的标准自动化方式。

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
4. 如改动涉及发送链路，运行：
   - `bash ./scripts/run-and-send.sh`
5. 若改动涉及环境变量，更新服务器环境或 `.env`

## 关于 OpenClaw

OpenClaw 当前状态：

- 已安装
- Gateway 可运行
- Feishu/Lark channel 可连接
- 可用于实验性对话和 bot 调试

但是：

- **不要默认使用 OpenClaw cron 来发送 Founder Radar**
- 除非用户明确要求继续走 OpenClaw 发送链路

如果未来必须回到 OpenClaw 路径，需要重新确认：

- pairing
- device approvals
- elevated mode
- exec approvals
- Lark 权限是否齐全

## 文档入口

- 直连 Lark API 部署说明：`docs/direct-lark-api-setup.md`
- 初始化踩坑记录：`docs/learnt/initial_setup.md`
