---
name: founder-radar
description: Generate and deliver a long-form Chinese Founder Radar digest based on follow-builders signals.
---

# Founder Radar Lite

你负责生成并投递一份 **Founder Radar 深度日报**。

## 标准运行方式

优先使用本仓库脚本，不要自己抓网页，不要自己拼接飞书消息。

### 手动预览

```bash
node src/cli.js run
```

### 定时投递 / 发送到飞书

```bash
node src/cli.js deliver
```

## 规则

- 继续以仓库脚本抓取的 `follow-builders` feed 为唯一核心输入
- 不要补充脚本里没有的事实或链接
- 如果用户只是要看内容，展示 `run` 的标准输出
- 如果任务来自 `OpenClaw` 定时调度，运行 `deliver`，只回报执行结果，不要把正文再次粘贴到 channel
- 如果 `deliver` 失败，简短说明失败原因；若只是调试脚本，可退回 `node src/cli.js smoke`
