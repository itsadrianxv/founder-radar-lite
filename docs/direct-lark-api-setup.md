# Repository-side Lark Delivery Setup

本文档描述的是 **仓库脚本负责飞书投递** 的那一段链路。
推荐做法是：`OpenClaw` 负责定时触发，仓库内的 `node src/cli.js deliver` 负责生成并发送日报。

## 一键部署（推荐）

在服务器上执行：

```bash
cd /home/admin/apps/founder-radar-lite
bash scripts/setup-server-cron.sh
```

该脚本会自动完成代码同步、依赖安装、`.env` 检查、crontab 写入和一次真实投递验证。
执行日志默认落在：

```bash
/tmp/founder-radar-cron.log
```

## 必需环境变量

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

可选：

```bash
export LARK_BASE_URL="https://open.larksuite.com"
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

## 手动验证

```bash
cd /home/admin/apps/founder-radar-lite
npm test
node src/cli.js smoke
node src/cli.js run
node src/cli.js deliver
```

预期：

- `run` 输出中文长版预览稿
- `deliver` 直接发送 3–5 条富文本消息到 `LARK_RECIPIENT_OPEN_ID`

## 脚本入口

OpenClaw 或其他调度器可以统一调用：

```bash
cd /home/admin/apps/founder-radar-lite
./scripts/run-and-send.sh
```

脚本内部会直接执行：

```bash
node src/cli.js deliver
```

## 失败排查

- 如果 `run` 失败，优先看 feed 拉取与 `FOUNDER_RADAR_LLM_*` 配置
- 如果 `deliver` 失败，优先看 Lark 凭据与 `LARK_RECIPIENT_OPEN_ID`
- 如果出现 `LARK_APP_ID is required`，说明当前 shell 或 cron 没有正确加载 `.env`
- 如果只是想验证仓库内的格式和分段逻辑，可先运行 `node src/cli.js smoke`
