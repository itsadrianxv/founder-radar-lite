import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('server setup script exists and includes one-command deploy flow', async () => {
  const script = await readFile('scripts/setup-server-cron.sh', 'utf-8');

  assert.match(script, /set -euo pipefail/);
  assert.match(script, /\/home\/admin\/apps\/founder-radar-lite/);
  assert.match(script, /git fetch --all --prune/);
  assert.match(script, /git checkout main/);
  assert.match(script, /git pull --ff-only origin main/);
  assert.match(script, /if \[\[ -f package-lock\.json \]\]/);
  assert.match(script, /npm ci/);
  assert.match(script, /npm install/);
  assert.match(script, /cp \.env\.example \.env/);
  assert.match(script, /FOLLOW_BUILDERS_FEED_BASE_URL/);
  assert.match(script, /FOUNDER_RADAR_LLM_API_KEY/);
  assert.match(script, /LARK_APP_ID/);
  assert.match(script, /0 9 \* \* \* \/usr\/bin\/env bash -lc/);
  assert.match(script, /run-and-send\.sh/);
  assert.match(script, /openclaw cron list/);
  assert.match(script, /Founder Radar Deep Digest/);
  assert.match(script, /openclaw cron remove/);
  assert.match(script, /sent \[0-9\]\+ rich message\\\(s\\\)/);
  assert.match(script, /\/tmp\/founder-radar-cron\.log/);
});

test('package.json exposes one-command server setup script', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf-8'));

  assert.equal(
    packageJson.scripts['server:setup-cron'],
    'bash ./scripts/setup-server-cron.sh'
  );
});

test('readme documents one-command server deployment path', async () => {
  const readme = await readFile('README.md', 'utf-8');

  assert.match(readme, /一键服务器部署/i);
  assert.match(readme, /bash scripts\/setup-server-cron\.sh/);
  assert.match(readme, /crontab/i);
});

test('direct-lark setup doc includes one-command deploy and troubleshooting', async () => {
  const doc = await readFile('docs/direct-lark-api-setup.md', 'utf-8');

  assert.match(doc, /bash scripts\/setup-server-cron\.sh/);
  assert.match(doc, /\/tmp\/founder-radar-cron\.log/);
  assert.match(doc, /LARK_APP_ID is required/);
});

test('openclaw setup doc is marked optional for scheduling', async () => {
  const doc = await readFile('docs/openclaw-lark-setup.md', 'utf-8');

  assert.match(doc, /可选/i);
  assert.match(doc, /crontab/i);
});
