# OpenClaw + Lark Setup

> 这是可选调度方案。默认推荐使用 `crontab` 一键部署（`bash scripts/setup-server-cron.sh`）。

## 目标

在阿里云服务器上常驻 `OpenClaw Gateway`，每天定时触发本仓库的 `deliver` 入口，由仓库脚本直接把深度日报发到你的飞书私聊。

如果你更关注稳定性和最少审批交互，建议改用系统 `crontab`：

```bash
cd /home/admin/apps/founder-radar-lite
bash scripts/setup-server-cron.sh
```

## 标准链路

1. `OpenClaw` 负责 cron 调度
2. `OpenClaw` 调用本仓库 skill
3. skill 运行 `node src/cli.js deliver`
4. 仓库脚本自行调用 Lark 官方 API 发送 3–5 条富文本消息
5. `OpenClaw` 只保留状态回报

## 1. 准备仓库

```bash
git clone <this-repo> ~/skills/founder-radar
cd ~/skills/founder-radar
npm test
```

## 2. 准备环境变量

在服务器 shell、systemd、`.env` 或 `OpenClaw` 运行环境里注入：

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

可选（来源裁剪策略，默认是全量来源不过滤）：

```bash
# 逗号分隔；include 为空表示不过滤；exclude 优先级更高
export FOUNDER_RADAR_PRUNE_X_INCLUDE_HANDLES=""
export FOUNDER_RADAR_PRUNE_X_EXCLUDE_HANDLES=""
export FOUNDER_RADAR_PRUNE_BLOG_INCLUDE_SOURCES=""
export FOUNDER_RADAR_PRUNE_BLOG_EXCLUDE_SOURCES=""
export FOUNDER_RADAR_PRUNE_PODCAST_INCLUDE_SOURCES=""
export FOUNDER_RADAR_PRUNE_PODCAST_EXCLUDE_SOURCES=""

# 未设置或 <=0 表示不限；非整数会报错退出
export FOUNDER_RADAR_PRUNE_MAX_X_CANDIDATES=""
export FOUNDER_RADAR_PRUNE_MAX_BLOG_CANDIDATES=""
export FOUNDER_RADAR_PRUNE_MAX_PODCAST_CANDIDATES=""
```

## 3. 验证仓库入口

```bash
cd ~/skills/founder-radar
node src/cli.js smoke
node src/cli.js run
node src/cli.js deliver
```

预期：

- `smoke` 输出一份中文深度日报
- `run` 输出真实 feed 的中文长版预览稿
- `deliver` 把 3–5 条富文本消息发到飞书私聊

## 4. 配置 OpenClaw

按 OpenClaw 官方文档安装并配置 `Feishu/Lark` channel。
这里的 channel 主要用于回报任务状态，不再承载完整日报正文。

## 5. 使用定时提示词

推荐把 `openclaw/founder-radar-daily.prompt.md` 的内容作为 cron message。

## 6. 创建每日定时任务

如果你仍然希望在飞书里收到 OpenClaw 的“执行成功/失败”回报，可以保留 channel 配置：

```bash
openclaw cron add \
  --name "Founder Radar Deep Digest" \
  --cron "0 9 * * *" \
  --tz "Asia/Shanghai" \
  --session isolated \
  --message "Use the founder-radar skill from ~/skills/founder-radar, run node src/cli.js deliver, and only report delivery status." \
  --announce \
  --channel feishu \
  --to "<TARGET_ID>" \
  --exact
```

## 7. 试跑

```bash
openclaw cron list
openclaw cron run <jobId>
```

如果试跑失败，优先检查：

- `OpenClaw Gateway` 是否在线
- 仓库环境变量是否完整
- `LARK_APP_ID` / `LARK_APP_SECRET` / `LARK_RECIPIENT_OPEN_ID` 是否正确
- `FOUNDER_RADAR_LLM_*` 是否可用
- 仓库路径是否与 cron message 一致
