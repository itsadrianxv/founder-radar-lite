import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

test('smoke command prints the founder radar markdown', async () => {
  const result = await runCli(['smoke']);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /# Founder Radar/);
  assert.match(result.stdout, /## 今日判断/);
  assert.match(result.stdout, /## Top Signals/);
});

test('run command fetches feeds from the configured base URL', async () => {
  const server = createFixtureServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const result = await runCli(['run'], {
      FOLLOW_BUILDERS_FEED_BASE_URL: baseUrl
    });

    assert.equal(result.code, 0);
    assert.match(result.stdout, /kevinweil/);
    assert.match(result.stdout, /claude\.com\/blog\/faster-agent-workflow/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
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

    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'not found' }));
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
