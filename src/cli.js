import { readFile } from 'node:fs/promises';

import { createOpenAiCompatibleClient } from './llm/openai-compatible-client.js';
import { createLarkClient, renderDigestPostMessages } from './lark/client.js';
import { buildDeepFounderRadarReport } from './radar/build-founder-radar.js';

const FEED_BASE_URL = process.env.FOLLOW_BUILDERS_FEED_BASE_URL
  || 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main';

async function main() {
  const [command = 'run'] = process.argv.slice(2);

  if (command === 'smoke') {
    const fixtureInput = JSON.parse(
      await readFile(new URL('../test/fixtures/smoke-bundle.json', import.meta.url), 'utf-8')
    );
    const report = buildDeepFounderRadarReport(fixtureInput, {
      language: process.env.FOUNDER_RADAR_LANGUAGE || 'zh-CN'
    });
    process.stdout.write(report.markdown);
    return;
  }

  if (!['run', 'deliver'].includes(command)) {
    throw new Error(`Unsupported command: ${command}`);
  }

  const bundle = await fetchFeedBundle();
  const fallbackReport = buildDeepFounderRadarReport(bundle, {
    language: process.env.FOUNDER_RADAR_LANGUAGE || 'zh-CN'
  });
  const llmClient = createOpenAiCompatibleClient();
  const report = await llmClient.enrichDigestReport(fallbackReport);

  if (command === 'run') {
    process.stdout.write(report.markdown);
    return;
  }

  const client = createLarkClient({
    appId: process.env.LARK_APP_ID,
    appSecret: process.env.LARK_APP_SECRET,
    baseUrl: process.env.LARK_BASE_URL
  });
  const messages = renderDigestPostMessages(report);
  const receiveId = process.env.LARK_RECIPIENT_OPEN_ID;

  if (!receiveId) {
    throw new Error('LARK_RECIPIENT_OPEN_ID is required for deliver');
  }

  const result = await client.sendPosts({
    receiveId,
    messages
  });

  process.stdout.write(`sent ${result.sent} rich message(s) to ${receiveId}\n`);
}

async function fetchFeedBundle() {
  const [feedX, feedPodcasts, feedBlogs] = await Promise.all([
    fetchJson(`${FEED_BASE_URL}/feed-x.json`),
    fetchJson(`${FEED_BASE_URL}/feed-podcasts.json`),
    fetchJson(`${FEED_BASE_URL}/feed-blogs.json`)
  ]);

  return {
    generatedAt: feedX.generatedAt || feedPodcasts.generatedAt || feedBlogs.generatedAt || new Date().toISOString(),
    x: feedX.x || [],
    podcasts: feedPodcasts.podcasts || [],
    blogs: feedBlogs.blogs || []
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'ai-builders-sync/0.1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  return response.json();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
