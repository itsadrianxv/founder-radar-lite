# OpenClaw + Lark Setup

## 目标

在阿里云服务器上常驻 `OpenClaw Gateway`，每天 `09:00`（`Asia/Shanghai`）把 `Founder Radar Lite` 推送到你的 `Lark` 机器人私聊。

## 1. 准备仓库

```bash
git clone <this-repo> ~/skills/founder-radar
cd ~/skills/founder-radar
npm test
```

## 2. 配置 OpenClaw 的 Lark channel

按 OpenClaw 官方 `Feishu/Lark` 文档安装 `@openclaw/feishu` 插件，并把 `domain` 设成 `lark`。  
这个仓库不保存你的 `Lark` 凭据；凭据只存在 OpenClaw 自己的配置里。

## 3. 验证技能可运行

```bash
cd ~/skills/founder-radar
node src/cli.js run
```

如果能打印完整 Markdown，就说明 skill 的核心逻辑已就绪。

## 4. 准备定时提示词

推荐把 `openclaw/founder-radar-daily.prompt.md` 的内容作为 cron message。

## 5. 创建每日定时任务

把 `<TARGET_ID>` 替换成你的 `Lark` 用户 `open_id`：

```bash
openclaw cron add \
  --name "Founder Radar Lite" \
  --cron "0 9 * * *" \
  --tz "Asia/Shanghai" \
  --session isolated \
  --message "Use the founder-radar skill from ~/skills/founder-radar and deliver today's report as raw markdown only." \
  --announce \
  --channel feishu \
  --to "<TARGET_ID>" \
  --exact
```

## 6. 立即试跑

```bash
openclaw cron list
openclaw cron run <jobId>
```

如果试跑失败，优先检查：

- `OpenClaw Gateway` 是否在线
- `feishu` channel 是否已经和 `Lark` 机器人成功配对
- `--channel feishu` 与 `--to <TARGET_ID>` 是否填写正确
- 仓库路径是否与 cron message 里一致

## 7. 推荐运维方式

- `OpenClaw Gateway` 常驻在阿里云
- 这个 skill 仓库按普通 git 仓库维护
- 每次升级后先跑 `npm test`
- 若需要 smoke 验证，可运行 `node src/cli.js smoke`
