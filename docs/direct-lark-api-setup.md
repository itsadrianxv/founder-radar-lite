# Direct Lark API Setup

这是当前推荐的生产部署方式：**不用 OpenClaw 发送日报**，而是直接在服务器上运行日报脚本，再调用 Lark 官方 API 把结果发到你的私聊。

## 环境变量

在服务器上准备 `.env` 或 shell 环境变量：

```bash
export FOLLOW_BUILDERS_FEED_BASE_URL="https://raw.githubusercontent.com/zarazhangrui/follow-builders/main"
export FOUNDER_RADAR_LANGUAGE="zh-CN"
export LARK_APP_ID="cli_your_app_id"
export LARK_APP_SECRET="your_app_secret"
export LARK_RECIPIENT_OPEN_ID="ou_your_open_id"
```

## 本地验证

```bash
cd /home/admin/apps/founder-radar-lite
npm test
node src/cli.js run
```

单独验证 Lark 发送：

```bash
printf '# Founder Radar\n\nHello from server.' | node src/send-lark.js --to "$LARK_RECIPIENT_OPEN_ID" --stdin
```

整体验证：

```bash
cd /home/admin/apps/founder-radar-lite
./scripts/run-and-send.sh
```

## 系统 cron

推荐直接用系统 `crontab`：

```bash
crontab -e
```

加入：

```cron
0 9 * * * cd /home/admin/apps/founder-radar-lite && /usr/bin/env bash ./scripts/run-and-send.sh >> /tmp/founder-radar-cron.log 2>&1
```

这样每天 `09:00`（服务器时区）会：

1. 运行 `node src/cli.js run`
2. 把输出保存到临时文件
3. 直接调用 Lark API 发给 `LARK_RECIPIENT_OPEN_ID`

## systemd timer（可选）

如果你更偏好 systemd，也可以用：

```ini
# ~/.config/systemd/user/founder-radar.service
[Unit]
Description=Founder Radar daily send

[Service]
Type=oneshot
WorkingDirectory=/home/admin/apps/founder-radar-lite
Environment=FOLLOW_BUILDERS_FEED_BASE_URL=https://raw.githubusercontent.com/zarazhangrui/follow-builders/main
Environment=FOUNDER_RADAR_LANGUAGE=zh-CN
Environment=LARK_APP_ID=cli_your_app_id
Environment=LARK_APP_SECRET=your_app_secret
Environment=LARK_RECIPIENT_OPEN_ID=ou_your_open_id
ExecStart=/usr/bin/env bash /home/admin/apps/founder-radar-lite/scripts/run-and-send.sh
```

```ini
# ~/.config/systemd/user/founder-radar.timer
[Unit]
Description=Run Founder Radar every day at 09:00

[Timer]
OnCalendar=*-*-* 09:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

启用：

```bash
systemctl --user daemon-reload
systemctl --user enable --now founder-radar.timer
systemctl --user list-timers | grep founder-radar
```
