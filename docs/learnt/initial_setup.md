# Initial Setup Learnt

本文记录 `Founder Radar Lite` 从 0 到首次在阿里云服务器上可运行的全过程经验、踩坑和当前推荐做法。

## 目标

目标是：

1. 在阿里云服务器上每日自动生成 `Founder Radar`
2. 把结果稳定发送到 Lark 私聊
3. 让本地修改能够通过 GitHub 私有仓库同步到服务器

## 已验证可工作的现状

- 私有 GitHub 仓库：`itsadrianxv/founder-radar-lite`
- 本地开发路径：`D:\课外项目\ai-builders-sync`
- 阿里云服务器路径：`/home/admin/apps/founder-radar-lite`
- 服务器系统：Ubuntu（用户 `admin`）
- `node` / `npm` / `git` 可用
- `Founder Radar` 主逻辑可通过 `node src/cli.js run` 正常输出 Markdown
- 推荐生产发送链路已经切换为：
  - `node src/cli.js run`
  - `node src/send-lark.js`
  - `scripts/run-and-send.sh`
  - Linux `crontab`

## 这次初始化中踩过的坑

### 1. GitHub CLI 不要用 Ubuntu 自带旧包

服务器最开始没有 `gh`。  
Ubuntu 源里的旧版 `gh` 容易过旧，最后使用的是 GitHub CLI 官方 apt 源安装。

结论：

- 安装 `gh` 时优先走 GitHub 官方 apt 源
- 然后用 `gh auth login` 拉私有仓库

### 2. OpenClaw Gateway 不是一开始就稳定

OpenClaw 安装后：

- `openclaw doctor --repair`
- `openclaw gateway start`
- `openclaw gateway status`

这些步骤是必要的。  
最开始出现过：

- service config 非标准
- systemd user service 未安装
- gateway 端口未监听

修复后才进入：

- `Runtime: running`
- `RPC probe: ok`
- `Listening: 127.0.0.1:18789`

### 3. Lark 应用必须开齐 Bot + WebSocket + 权限

Lark 自建应用至少要保证：

- 开启 Bot
- 事件订阅方式使用 WebSocket / 长连接
- 添加事件：`im.message.receive_v1`

权限方面，实际遇到过明确报错：

- `contact:contact.base:readonly`

即使主链路似乎能跑，权限不足也会导致日志长期出现 400 错误。  
结论：

- 补完权限后必须重新发布应用
- 如仍用 OpenClaw channel，建议再重启 gateway

### 4. OpenClaw 的 DM pairing 和 device pairing 是两回事

配置 Feishu/Lark channel 后，需要分别注意：

- Lark 私聊发消息触发 sender pairing
- 本机 CLI 连接 gateway 还可能触发 device/operator pairing

日志里出现过：

- `pairing required`
- `device access upgrade requested`

这意味着：

- 消息通了，不代表 CLI 侧就完全有权限

### 5. OpenClaw cron 发送 Founder Radar 不稳定

虽然 OpenClaw 能：

- 收到 Lark 私聊
- 建立 cron job
- 跑到 Founder Radar 正文生成阶段

但实际遇到了多种会把任务带偏的问题：

- 反复的 `/approve ... allow-once`
- `elevated is not available right now`
- agent 自动开始做 identity / memory onboarding
- cron summary 被投递成审批消息，而不是正文
- 日报正文虽然生成成功，但不稳定地没有最终送达

结论：

**OpenClaw 可以保留用于实验和对话，但不应作为 Founder Radar 每日报送的生产发送层。**

## 当前推荐生产架构

当前推荐方案是：

1. 服务器本地执行 `node src/cli.js run`
2. 通过 `src/send-lark.js` 直接调用 Lark 官方 API 发送
3. 用 `scripts/run-and-send.sh` 封装两步
4. 用系统 `crontab` 每天触发

这样做的好处：

- 不依赖 OpenClaw 的 approval / elevated / memory / agent 行为
- 故障边界清晰
- 易于调试
- 更接近“确定性脚本 + 官方发送 API”

## 当前推荐的服务器侧验证顺序

### 单独验证日报生成

```bash
cd /home/admin/apps/founder-radar-lite
node src/cli.js run
```

### 单独验证 Lark 发送

```bash
printf '# Founder Radar\n\nHello from direct Lark API.' | node src/send-lark.js --to "$LARK_RECIPIENT_OPEN_ID" --stdin
```

### 验证完整链路

```bash
cd /home/admin/apps/founder-radar-lite
bash ./scripts/run-and-send.sh
```

## 当前推荐的自动化方式

使用系统 `crontab`，而不是 OpenClaw cron。

推荐条目：

```cron
0 9 * * * cd /home/admin/apps/founder-radar-lite && /usr/bin/env bash ./scripts/run-and-send.sh >> /tmp/founder-radar-cron.log 2>&1
```

## 后续维护建议

- 若 Lark 不再收消息，优先验证：
  - `node src/send-lark.js`
  - `bash ./scripts/run-and-send.sh`
  - `LARK_APP_ID` / `LARK_APP_SECRET` / `LARK_RECIPIENT_OPEN_ID`
- 若 feed 抓取失败，优先验证：
  - `node src/cli.js run`
  - `FOLLOW_BUILDERS_FEED_BASE_URL`
- 若必须继续研究 OpenClaw 路径，先把它视为单独项目，不要和生产日报投递混在一起

## 结论

这次初始化的最重要经验是：

> **Founder Radar 的核心脚本本身没问题；不稳定的是“让 agent 再代你发消息”这一层。**

因此目前的标准做法是：

> **保留脚本生成，直接调用 Lark API 发送。**
