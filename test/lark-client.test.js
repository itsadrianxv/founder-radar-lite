import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

import { createLarkClient, splitLarkText } from '../src/lark/client.js';

test('splitLarkText keeps short founder radar text in one chunk', () => {
  const chunks = splitLarkText('# Founder Radar\n\nShort update.', 50);
  assert.deepEqual(chunks, ['# Founder Radar\n\nShort update.']);
});

test('splitLarkText breaks long text on paragraph boundaries', () => {
  const text = [
    '# Founder Radar',
    '',
    '## 今日判断',
    '- 第一段内容很长很长很长很长很长',
    '',
    '## Top Signals',
    '- 第二段内容也很长很长很长很长很长'
  ].join('\n');

  const chunks = splitLarkText(text, 40);

  assert.ok(chunks.length >= 2);
  assert.match(chunks.join('\n\n'), /今日判断[\s\S]*Top Signals/);
});

test('createLarkClient fetches token and sends one text message', async () => {
  const traffic = [];
  const server = createMockLarkServer(traffic);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const client = createLarkClient({
      appId: 'cli_test_app',
      appSecret: 'secret_test',
      baseUrl
    });

    const result = await client.sendText({
      receiveId: 'ou_target',
      text: '# Founder Radar\n\nHello Lark.'
    });

    assert.equal(result.sent, 1);
    assert.equal(traffic.length, 2);
    assert.equal(traffic[0].path, '/open-apis/auth/v3/tenant_access_token/internal');
    assert.equal(traffic[1].path, '/open-apis/im/v1/messages?receive_id_type=open_id');
    assert.equal(traffic[1].body.receive_id, 'ou_target');
    assert.equal(traffic[1].body.msg_type, 'text');
    assert.match(traffic[1].body.content, /Founder Radar/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('createLarkClient splits oversized text into multiple messages', async () => {
  const traffic = [];
  const server = createMockLarkServer(traffic);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const client = createLarkClient({
      appId: 'cli_test_app',
      appSecret: 'secret_test',
      baseUrl,
      maxTextLength: 40
    });

    const result = await client.sendText({
      receiveId: 'ou_target',
      text: ['# Founder Radar', '', 'A'.repeat(35), '', 'B'.repeat(35)].join('\n')
    });

    assert.ok(result.sent >= 2);
    assert.equal(traffic.filter((item) => item.path.startsWith('/open-apis/im/v1/messages')).length, result.sent);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('send-lark cli reads a file and delivers it', async () => {
  const traffic = [];
  const server = createMockLarkServer(traffic);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const dir = await mkdtemp(join(tmpdir(), 'founder-radar-lark-'));
  const file = join(dir, 'report.md');
  await writeFile(file, '# Founder Radar\n\nCLI delivery.', 'utf-8');

  try {
    const result = await runNode([
      'src/send-lark.js',
      '--to',
      'ou_target',
      '--file',
      file
    ], {
      LARK_APP_ID: 'cli_test_app',
      LARK_APP_SECRET: 'secret_test',
      LARK_BASE_URL: baseUrl
    });

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /sent 1 message/);
    assert.equal(traffic.length, 2);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

function createMockLarkServer(traffic) {
  return createServer(async (request, response) => {
    const body = await readRequestBody(request);
    const parsed = body ? JSON.parse(body) : null;
    traffic.push({
      method: request.method,
      path: request.url,
      body: parsed
    });

    response.setHeader('Content-Type', 'application/json');

    if (request.url === '/open-apis/auth/v3/tenant_access_token/internal') {
      response.end(JSON.stringify({
        code: 0,
        tenant_access_token: 'token_test'
      }));
      return;
    }

    if (request.url?.startsWith('/open-apis/im/v1/messages?receive_id_type=open_id')) {
      response.end(JSON.stringify({
        code: 0,
        data: {
          message_id: `om_${traffic.length}`
        }
      }));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ code: 404 }));
  });
}

function readRequestBody(request) {
  return new Promise((resolve) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => resolve(body));
  });
}

function runNode(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}
