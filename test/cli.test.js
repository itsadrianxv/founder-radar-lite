import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

test('smoke command prints the founder radar markdown', async () => {
  const result = await runCli(['smoke']);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /# Founder Radar 深度日报/);
  assert.match(result.stdout, /## 今日结论/);
  assert.match(result.stdout, /## 核心论证/);
});

test('run command fetches feeds and renders the model-backed long digest', async () => {
  const server = createFixtureServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const result = await runCli(['run'], {
      FOLLOW_BUILDERS_FEED_BASE_URL: baseUrl,
      FOUNDER_RADAR_LLM_BASE_URL: `${baseUrl}/v1`,
      FOUNDER_RADAR_LLM_API_KEY: 'test_key',
      FOUNDER_RADAR_LLM_MODEL: 'deepseek-reasoner'
    });

    assert.equal(result.code, 0);
    assert.match(result.stdout, /如果只把这波变化理解成模型更强，那你会低估真正的组织变化/);
    assert.match(result.stdout, /## 创始人行动建议/);
    assert.match(result.stdout, /https:\/\/claude\.com\/blog\/faster-agent-workflow/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('deliver command sends rich Feishu posts instead of raw markdown text', async () => {
  const appServer = createFixtureServer();
  const larkTraffic = [];
  const larkServer = createLarkServer(larkTraffic);

  await new Promise((resolve) => appServer.listen(0, '127.0.0.1', resolve));
  await new Promise((resolve) => larkServer.listen(0, '127.0.0.1', resolve));

  const appAddress = appServer.address();
  const larkAddress = larkServer.address();
  const feedBaseUrl = `http://127.0.0.1:${appAddress.port}`;
  const larkBaseUrl = `http://127.0.0.1:${larkAddress.port}`;

  try {
    const result = await runCli(['deliver'], {
      FOLLOW_BUILDERS_FEED_BASE_URL: feedBaseUrl,
      FOUNDER_RADAR_LLM_BASE_URL: `${feedBaseUrl}/v1`,
      FOUNDER_RADAR_LLM_API_KEY: 'test_key',
      FOUNDER_RADAR_LLM_MODEL: 'deepseek-reasoner',
      LARK_APP_ID: 'cli_test_app',
      LARK_APP_SECRET: 'secret_test',
      LARK_BASE_URL: larkBaseUrl,
      LARK_RECIPIENT_OPEN_ID: 'ou_target'
    });

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /sent 4 rich message\(s\)/);

    const sentMessages = larkTraffic.filter((item) => item.path.startsWith('/open-apis/im/v1/messages'));
    assert.equal(sentMessages.length, 4);
    assert.equal(sentMessages.every((item) => item.body.msg_type === 'post'), true);
    assert.equal(sentMessages.some((item) => /## /.test(item.body.content)), false);
  } finally {
    await new Promise((resolve, reject) => appServer.close((error) => (error ? reject(error) : resolve())));
    await new Promise((resolve, reject) => larkServer.close((error) => (error ? reject(error) : resolve())));
  }
});

function createFixtureServer() {
  const bundle = JSON.parse(`{
    "generatedAt": "2026-04-01T07:18:03.375Z",
    "x": [{
      "source": "x",
      "name": "Kevin Weil",
      "handle": "kevinweil",
      "bio": "VP Science @OpenAI",
      "tweets": [{
        "id": "2",
        "text": "AI is solving more open problems and the proofs are getting more elegant.",
        "createdAt": "2026-04-01T04:38:05.000Z",
        "url": "https://x.com/kevinweil/status/2",
        "likes": 116,
        "retweets": 7,
        "replies": 18,
        "isQuote": true,
        "quotedTweetId": "22"
      }]
    }],
    "podcasts": [{
      "source": "podcast",
      "name": "Latent Space",
      "title": "Why agents keep failing and what tool curation fixes",
      "url": "https://youtube.com/watch?v=latent-space",
      "publishedAt": "2026-03-31T00:00:00.000Z",
      "transcript": "Tool selection accuracy drops when agents have too many tools. Better tool curation wins."
    }],
    "blogs": [{
      "source": "blog",
      "name": "Claude Blog",
      "title": "Claude ships a faster agent workflow",
      "url": "https://claude.com/blog/faster-agent-workflow",
      "publishedAt": "2026-04-01T01:00:00.000Z",
      "author": "Anthropic",
      "description": "Workflow update",
      "content": "Claude ships a faster agent workflow with better tool use and more reliable reviews."
    }]
  }`);

  return createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');

    if (request.url === '/feed-x.json') {
      response.end(JSON.stringify({
        generatedAt: bundle.generatedAt,
        x: bundle.x
      }));
      return;
    }

    if (request.url === '/feed-podcasts.json') {
      response.end(JSON.stringify({
        generatedAt: bundle.generatedAt,
        podcasts: bundle.podcasts
      }));
      return;
    }

    if (request.url === '/feed-blogs.json') {
      response.end(JSON.stringify({
        generatedAt: bundle.generatedAt,
        blogs: bundle.blogs
      }));
      return;
    }

    if (request.url === '/v1/chat/completions' && request.method === 'POST') {
      response.end(JSON.stringify({
        id: 'chatcmpl_test',
        object: 'chat.completion',
        created: 1,
        model: 'deepseek-reasoner',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify({
              title: 'Founder Radar 深度日报｜2026/04/01',
              intro: '今天最值得关注的，不是单点产品发布，而是构建者正在把模型能力、工作流和组织方式一起重写。',
              sections: {
                todayVerdict: [
                  '如果只把这波变化理解成模型更强，那你会低估真正的组织变化：团队开始把 agent 当作默认协作者，而不是一次性演示。',
                  '高质量机会集中在把“生成、审核、发布、复盘”串成闭环的产品层，而不是再做一个泛化助手。',
                  '对创始人来说，今天最重要的不是追热点，而是判断哪条关键工作流最值得率先产品化。'
                ],
                coreArguments: [
                  {
                    title: '论证一：agent 工作流已经进入要对真实交付负责的阶段',
                    paragraphs: [
                      '从 Amjad Masad、Claude Blog 和 Latent Space 的信号看，讨论重点都在往稳定工作流收敛。大家不再满足于“能做出一个 demo”，而是更在意它能否接住复杂任务、减少返工，并在团队内部被持续复用。',
                      '这意味着产品的核心竞争从“模型会不会”转向“这套链路能不能稳定交付”。如果你还只是展示一个会聊天、会生成的界面，很容易被下一轮更完整的工作流产品替代。'
                    ],
                    citations: [
                      { "label": "Amjad Masad", "url": "https://x.com/amasad/status/3" },
                      { "label": "Claude Blog", "url": "https://claude.com/blog/faster-agent-workflow" },
                      { "label": "Latent Space", "url": "https://youtube.com/watch?v=latent-space" }
                    ]
                  },
                  {
                    title: '论证二：研究进展会反向抬高用户对产品的想象上限',
                    paragraphs: [
                      'Kevin Weil 这类信号释放出的不是抽象 optimism，而是一个直接后果：用户会更快接受“更难的问题也该被工具解决”。这会让所有围绕效率、代理、知识工作的新产品都面临更高预期。',
                      '因此，真正值得警惕的不是今天有没有追上某个新模型，而是你的产品是否把能力提升翻译成了更可靠、更可解释、更便于协作的体验。'
                    ],
                    citations: [
                      { "label": "Kevin Weil", "url": "https://x.com/kevinweil/status/2" }
                    ]
                  },
                  {
                    title: '论证三：小团队高杠杆叙事会继续强化',
                    paragraphs: [
                      'Garry Tan 一类信号说明，资本与创业叙事已经默认接受“更少的人做更多的事”。这不只是成本故事，而是组织设计故事：谁能把人和 agent 的接口做清楚，谁就更有可能跑出速度优势。',
                      '这会把更多价值推向中间层：审核、编排、观测、复盘、权限边界。这些能力不像模型那样吸睛，却直接决定一家公司能不能把新工具真正带进生产流程。'
                    ],
                    citations: [
                      { "label": "Garry Tan", "url": "https://x.com/garrytan/status/4" }
                    ]
                  }
                ],
                counterpoints: [
                  '第一，社交平台和博客信号天然偏向前沿样本，不代表大多数团队已经具备接住复杂 agent 工作流的流程能力。',
                  '第二，如果交付链路里的审核、权限与回滚机制没有跟上，所谓的高杠杆只会把错误更快放大。'
                ],
                actionItems: [
                  {
                    title: '动作一：锁定一条高频、高价值、需要审核的工作流',
                    paragraphs: [
                      '优先找出你团队里最值得被产品化的一条链路，例如“信息搜集 → 初稿生成 → 人工审核 → 对外发布”。不要先追求全能，而要先把单条链路做出可靠感。'
                    ]
                  },
                  {
                    title: '动作二：把默认输出格式升级为“结论 + 证据 + 风险”',
                    paragraphs: [
                      '这会让模型产出更容易被团队接手，也更容易在跨职能协作中流动。组织真正需要的不是更多文本，而是更容易被判断和决策的文本。'
                    ]
                  },
                  {
                    title: '动作三：把观测和复盘设计成产品的一部分',
                    paragraphs: [
                      '如果你无法回看 agent 在哪一步失真、为什么返工、什么场景最稳定，那你的产品就很难在真实团队里长期存在。'
                    ]
                  }
                ],
                readNext: [
                  { "label": "Claude Blog：Claude ships a faster agent workflow", "url": "https://claude.com/blog/faster-agent-workflow" },
                  { "label": "Kevin Weil on X", "url": "https://x.com/kevinweil/status/2" },
                  { "label": "Amjad Masad on X", "url": "https://x.com/amasad/status/3" }
                ]
              }
            })
          },
          finish_reason: 'stop'
        }]
      }));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'not found' }));
  });
}

function createLarkServer(traffic) {
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

function runCli(args, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['src/cli.js', ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...extraEnv
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
