import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

import { createLarkClient, renderDigestPostMessages, splitLarkText } from '../src/lark/client.js';

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

test('renderDigestPostMessages produces 3 to 5 rich messages without markdown syntax', () => {
  const messages = renderDigestPostMessages({
    title: 'Founder Radar 深度日报｜2026/04/01',
    intro: '今天最值得关注的不是单点产品发布，而是 AI 构建者开始把工作流、团队组织与分发策略一起重写。',
    sections: {
      todayVerdict: [
        '结论一：agent 工作流进入从演示走向交付的阶段。',
        '结论二：小团队高杠杆继续强化。',
        '结论三：真正的机会在工作流闭环。'
      ],
      coreArguments: [
        {
          title: '论证一：agent 工作流正在从概念走向组织默认配置',
          paragraphs: [
            '从 Amjad Masad、Claude Blog 与 Latent Space 的信号看，讨论焦点已经不是 agent 能不能做事，而是谁能把工具挑选、审核和交付闭环做稳。',
            '这意味着产品竞争会从模型能力展示，转向对真实任务链路的可靠性和产出密度负责。'
          ],
          citations: [
            { label: 'Amjad Masad', url: 'https://x.com/amasad/status/3' },
            { label: 'Claude Blog', url: 'https://claude.com/blog/faster-agent-workflow' }
          ]
        },
        {
          title: '论证二：研究进展正在反向抬高产品预期',
          paragraphs: [
            'Kevin Weil 一类信号提醒我们，模型能力提升不再只是 benchmark 层面的新闻，而是在改变用户对产品“应该做到什么”的想象。',
            '因此，叙事不能停留在更聪明，而要落到更可靠、更优雅、更可解释。'
          ],
          citations: [
            { label: 'Kevin Weil', url: 'https://x.com/kevinweil/status/2' }
          ]
        }
      ],
      counterpoints: [
        '反论点一：社交媒体信号天然偏向前沿话题，不等于大多数团队已经准备好组织升级。',
        '反论点二：如果没有稳定的交付与审核机制，长工作流只会放大噪音。'
      ],
      actionItems: [
        {
          title: '动作一：优先找出你团队最适合被工作流产品化的单条链路',
          paragraphs: [
            '与其追求全能 agent，不如先锁定一个高频、跨多人协作、需要审核的核心流程，把它做成可重复交付的操作台。'
          ]
        },
        {
          title: '动作二：把“结论 + 证据 + 风险”当成默认输出格式',
          paragraphs: [
            '当模型参与日常工作后，组织需要的不是更多答案，而是更容易被审核和接手的答案。'
          ]
        }
      ],
      readNext: [
        { label: 'Kevin Weil on X', url: 'https://x.com/kevinweil/status/2' },
        { label: 'Claude Blog', url: 'https://claude.com/blog/faster-agent-workflow' }
      ]
    }
  });

  assert.ok(messages.length >= 3 && messages.length <= 5);
  for (const message of messages) {
    assert.ok(message.title);
    assert.ok(message.lines.length > 0);
    assert.equal(message.lines.some((line) => line.some((node) => node.text?.includes('## '))), false);
  }
});

test('createLarkClient sends rich post messages in sequence', async () => {
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

    const result = await client.sendPosts({
      receiveId: 'ou_target',
      messages: [
        {
          title: 'Founder Radar 深度日报｜2026/04/01',
          lines: [
            [{ tag: 'text', text: '今日结论：小团队与 agent 工作流正在一起改写交付方式。' }]
          ]
        },
        {
          title: '创始人行动建议',
          lines: [
            [{ tag: 'text', text: '优先把最关键的一条工作流做成可审核、可交接、可复盘的产品能力。' }]
          ]
        }
      ]
    });

    assert.equal(result.sent, 2);
    assert.equal(traffic.length, 3);
    assert.equal(traffic[1].body.msg_type, 'post');
    assert.equal(traffic[2].body.msg_type, 'post');
    assert.match(traffic[1].body.content, /Founder Radar 深度日报/);
    assert.match(traffic[2].body.content, /创始人行动建议/);
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
