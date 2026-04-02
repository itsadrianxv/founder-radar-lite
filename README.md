# Founder Radar Lite

一个围绕 [`follow-builders`](https://github.com/zarazhangrui/follow-builders) 核心 feed 搭建的每日 Founder Radar。
它保留精选信源、启发式排序和轻量结构，但把最终输出升级成 **20 分钟阅读级别的中文判断型深度日报**，并直接由仓库脚本把精排后的富文本消息发到飞书。

## 当前标准运行方式

标准生产链路是：

1. 阿里云服务器上的 `OpenClaw` 负责定时调度
2. `OpenClaw` 触发本仓库的 `node src/cli.js deliver`
3. 仓库脚本抓取 `follow-builders` feed，生成中文长摘要
4. 仓库脚本直接调用 Lark 官方 API，分 3–5 条富文本消息发到飞书私聊
5. `OpenClaw` 只回报执行状态，不再直接转发原始 Markdown 正文

## 主要特性

- 继续以 `follow-builders` 为核心输入，不额外抓取原文网页
- 保留核心信源过滤：指定 X 账号、`Claude Blog` / `Anthropic Engineering`、`Latent Space` / `No Priors`
- 默认输出固定结构：`今日结论`、`核心论证`、`反论点与不确定性`、`创始人行动建议`、`延伸阅读`
- 支持 `OpenAI` 兼容接口的模型配置，默认适配 `DeepSeek Reasoner`
- 飞书投递默认使用 `post` 富文本消息，而不是把原始 Markdown 当纯文本发送

## CLI

```bash
npm test
npm run radar:smoke
npm run radar:run
npm run radar:deliver
```

- `node src/cli.js smoke`：用内置 fixture 生成一份本地 smoke 版深度日报
- `node src/cli.js run`：抓取最新 feed，输出中文长版预览稿
- `node src/cli.js deliver`：抓取 feed、生成长摘要，并直接发送到飞书

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

说明：

- 如果未提供 `FOUNDER_RADAR_LLM_API_KEY`，脚本会回退到仓库内置的确定性长摘要生成逻辑
- `LARK_BASE_URL` 可选，默认使用 `https://open.larksuite.com`
- 不要把真实 secret 写入仓库

## OpenClaw

这个仓库仍然推荐与 `OpenClaw` 配合使用，但 **OpenClaw 的职责是调度，不是直接转发正文**。
完整配置方式见 `docs/openclaw-lark-setup.md`。

## 文档

- `docs/openclaw-lark-setup.md`：OpenClaw 调度 + 仓库直发飞书的标准部署方式
- `docs/direct-lark-api-setup.md`：仓库内飞书投递链路与环境变量说明
- `docs/learnt/initial_setup.md`：历史踩坑记录

## 部署验证

仓库带有最小 Docker smoke deployment：

- `deploy/docker-compose.yml`
- `deploy/deploy-main.ps1`

它的目标是验证：

1. `docker compose config` 成功
2. smoke 容器能启动
3. 关键环境变量在容器内可见

验证命令：

```powershell
powershell -ExecutionPolicy Bypass -File deploy\deploy-main.ps1 `
  -Services founder_radar_smoke `
  -RequiredEnv FOLLOW_BUILDERS_FEED_BASE_URL,FOUNDER_RADAR_LANGUAGE,FOUNDER_RADAR_LLM_BASE_URL,FOUNDER_RADAR_LLM_API_KEY,FOUNDER_RADAR_LLM_MODEL,LARK_APP_ID,LARK_APP_SECRET,LARK_RECIPIENT_OPEN_ID
```
