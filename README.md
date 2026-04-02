# Founder Radar Lite

一个基于 [`follow-builders`](https://github.com/zarazhangrui/follow-builders) feed 的每日 Founder Radar。

当前版本的定位很明确：

- 用仓库脚本抓取 `follow-builders` 全量信号，并按可配置策略裁剪
- 生成一份中文、长篇、判断型的 Founder Radar 深度日报
- 把日报分成 3–5 条飞书富文本消息发送出去
- 由阿里云服务器上的 `OpenClaw` 负责定时调度，不再让 `OpenClaw` 直接转发原始 Markdown 正文

## 当前标准链路

生产环境的标准运行方式是：

1. `OpenClaw cron` 定时触发本仓库
2. 仓库执行 `node src/cli.js deliver`
3. 脚本抓取 `follow-builders` feed
4. 仓库内的摘要生成逻辑产出深度日报；如果配置了模型接口，则进一步用模型增强中文长摘要
5. 仓库直接调用 Lark 官方 API，把日报作为 3–5 条 `post` 富文本消息发送到飞书私聊
6. `OpenClaw` 只负责回报成功或失败状态

## 当前能力

- 默认使用 `follow-builders` 的全量输入（X / blogs / podcasts）
- 支持按环境变量裁剪来源：X 账号 include/exclude、博客/播客来源 include/exclude、每类 TopN 上限
- 默认输出结构：`今日结论`、`核心论证`、`反论点与不确定性`、`创始人行动建议`、`延伸阅读`
- 支持 `OpenAI` 兼容接口，默认可接 `DeepSeek Reasoner`
- 默认发送飞书富文本，不再把 Markdown 当纯文本硬发
- 如果没有配置 `FOUNDER_RADAR_LLM_API_KEY`，会回退到仓库内置的确定性长摘要生成逻辑

## CLI

```bash
npm test
npm run radar:smoke
npm run radar:run
npm run radar:deliver
```

对应入口：

- `node src/cli.js smoke`：用 fixture 生成一份 smoke 版深度日报
- `node src/cli.js run`：抓取真实 feed，输出中文长版预览稿
- `node src/cli.js deliver`：抓取 feed、生成摘要并直接发送到飞书
- `node src/send-lark.js`：底层飞书发送脚本，主要用于单独调试发送能力，不是标准生产入口

## 环境变量

```bash
FOLLOW_BUILDERS_FEED_BASE_URL=https://raw.githubusercontent.com/zarazhangrui/follow-builders/main
FOUNDER_RADAR_LANGUAGE=zh-CN
FOUNDER_RADAR_LLM_BASE_URL=https://api.deepseek.com/v1
FOUNDER_RADAR_LLM_API_KEY=your_api_key
FOUNDER_RADAR_LLM_MODEL=deepseek-reasoner
LARK_APP_ID=cli_your_app_id
LARK_APP_SECRET=your_app_secret
LARK_RECIPIENT_OPEN_ID=ou_your_open_id
```

可选：

```bash
LARK_BASE_URL=https://open.larksuite.com
```

可选（裁剪策略）：

```bash
# 逗号分隔；include 为空表示不过滤；exclude 优先级更高
FOUNDER_RADAR_PRUNE_X_INCLUDE_HANDLES=
FOUNDER_RADAR_PRUNE_X_EXCLUDE_HANDLES=
FOUNDER_RADAR_PRUNE_BLOG_INCLUDE_SOURCES=
FOUNDER_RADAR_PRUNE_BLOG_EXCLUDE_SOURCES=
FOUNDER_RADAR_PRUNE_PODCAST_INCLUDE_SOURCES=
FOUNDER_RADAR_PRUNE_PODCAST_EXCLUDE_SOURCES=

# 未设置或 <=0 表示不限；非整数会直接报错退出
FOUNDER_RADAR_PRUNE_MAX_X_CANDIDATES=
FOUNDER_RADAR_PRUNE_MAX_BLOG_CANDIDATES=
FOUNDER_RADAR_PRUNE_MAX_PODCAST_CANDIDATES=
```

## 本地与服务器验证

手动验证顺序：

```bash
npm test
node src/cli.js smoke
node src/cli.js run
node src/cli.js deliver
```

如果你是在服务器上走标准链路，优先再补一次 `OpenClaw cron` 手动触发，确认飞书里收到的是精排后的多条中文消息。

## OpenClaw

这个仓库现在仍然推荐与 `OpenClaw` 配合使用，但职责已经收敛成：

- `OpenClaw`：调度 + 状态回报
- 本仓库：内容生成 + 飞书发送

OpenClaw 相关配置见 `docs/openclaw-lark-setup.md`。

## 文档入口

- `docs/openclaw-lark-setup.md`：OpenClaw 调度方式
- `docs/direct-lark-api-setup.md`：仓库内飞书发送链路
- `docs/learnt/initial_setup.md`：历史踩坑记录

## 部署验证

仓库包含最小 Docker smoke deployment，用于验证：

- `docker compose config` 能通过
- smoke 容器能启动
- 关键环境变量在容器内可见

入口：

- `deploy/docker-compose.yml`
- `deploy/deploy-main.ps1`
