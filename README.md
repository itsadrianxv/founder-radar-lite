# Founder Radar Lite

一个轻量、近乎无状态的每日 `Founder Radar`。  
它直接读取 `follow-builders` 的远程 feed，筛出核心硅谷 AI 构建者信号，生成一份适合 `Lark` 私聊阅读的 Markdown 简报。

Inspired by [follow-builders by zarazhangrui](https://github.com/zarazhangrui/follow-builders).

Recommended production path: run `node src/cli.js run` locally on your server and deliver the result via the official Lark API. See `docs/direct-lark-api-setup.md`.

## 特性

- 单次运行、无数据库、无长期 memory
- 只保留核心信源：指定 X 账号、`Claude Blog` / `Anthropic Engineering`、`Latent Space` / `No Priors`
- 固定输出 5 个板块：`今日判断`、`Top Signals`、`Who to Watch`、`Opportunity Seeds`、`Read Next`
- 可直接由 `OpenClaw` 定时触发并投递到 `Lark`

## 本地使用

```bash
npm test
npm run radar:smoke
npm run radar:run
```

默认会从：

`https://raw.githubusercontent.com/zarazhangrui/follow-builders/main`

读取 `feed-x.json`、`feed-podcasts.json` 和 `feed-blogs.json`。

可通过环境变量覆盖：

```bash
FOLLOW_BUILDERS_FEED_BASE_URL=https://your-mirror.example.com
FOUNDER_RADAR_LANGUAGE=zh-CN
```

## OpenClaw + Lark

这个仓库本身不直接管理 `Lark` 凭据；`Lark` 发送由 `OpenClaw` 的 `feishu` channel 插件负责。

推荐部署形态：

1. 在阿里云服务器安装并常驻 `OpenClaw Gateway`
2. 为 `OpenClaw` 配置 `Lark` channel
3. 把本仓库作为一个本地 skill 仓库挂到 `OpenClaw`
4. 用 `openclaw cron add` 每天 `09:00`（`Asia/Shanghai`）触发 `Founder Radar`

完整步骤见 `docs/openclaw-lark-setup.md`。

## Skill

根目录的 `SKILL.md` 是给 `OpenClaw` / 其他 agent 直接使用的说明书。  
当 agent 需要产出日报时，它只需要运行：

```bash
node src/cli.js run
```

然后把标准输出里的 Markdown 原样发给你。

## 部署验证

项目带了一个最小 Docker smoke deployment：

- `deploy/docker-compose.yml`
- `deploy/deploy-main.ps1`

它的目标不是代替 `OpenClaw`，而是让 `deploy-main` 流程可以验证：

1. `docker compose config` 成功
2. 容器能启动
3. 关键环境变量在容器内可见

部署验证命令：

```powershell
powershell -ExecutionPolicy Bypass -File deploy\deploy-main.ps1 `
  -Services founder_radar_smoke `
  -RequiredEnv FOLLOW_BUILDERS_FEED_BASE_URL,FOUNDER_RADAR_LANGUAGE,LARK_DOMAIN
```
