---
name: founder-radar
description: Lightweight daily Founder Radar for the Silicon Valley AI builder scene. Use when the user wants a concise China-friendly radar with verdicts, evidence, watchlist, and opportunity seeds.
---

# Founder Radar Lite

你负责生成一份 **Founder Radar Lite**，默认发给用户的 `Lark` 私聊。

## 运行方式

永远优先使用本仓库的确定性脚本，不要自己抓网页。

```bash
node src/cli.js run
```

脚本会：

- 拉取 `follow-builders` 的远程 feed
- 只保留本项目定义的核心信源
- 做启发式排序
- 输出最终 Markdown

## 输出规则

- 直接输出脚本产出的 Markdown
- 不要在前后再加解释性废话
- 不要补充脚本里没有的链接
- 如果用户只是要手动看日报，直接把 Markdown 展示出来
- 如果当前平台是 `OpenClaw`，并且任务来自定时投递，就把 Markdown 原样发到当前 channel

## 调整范围

如果用户要求改风格或换时间：

- 风格：改脚本模板和排序逻辑，不引入数据库
- 时间 / channel：改 `OpenClaw` 的 cron 配置，不改日报脚本

## 故障处理

如果 `node src/cli.js run` 失败：

1. 说明是 feed 拉取失败还是本地脚本失败
2. 如果只是远程 feed 不可用，不要编造内容
3. 可以退回 `node src/cli.js smoke` 生成一份本地 smoke 结果，用来验证脚本本身没坏
