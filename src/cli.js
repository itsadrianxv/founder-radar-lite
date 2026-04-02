import { readFile } from 'node:fs/promises';

import { createOpenAiCompatibleClient } from './llm/openai-compatible-client.js';
import { createLarkClient, renderDigestPostMessages } from './lark/client.js';
import { buildDeepFounderRadarReport } from './radar/build-founder-radar.js';

const FEED_BASE_URL = process.env.FOLLOW_BUILDERS_FEED_BASE_URL
  || 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main';

async function main() {
  const [command = 'run'] = process.argv.slice(2);
  const radarOptions = buildRadarOptionsFromEnv(process.env);

  if (command === 'smoke') {
    const fixtureInput = JSON.parse(
      await readFile(new URL('../test/fixtures/smoke-bundle.json', import.meta.url), 'utf-8')
    );
    const report = buildDeepFounderRadarReport(fixtureInput, radarOptions);
    process.stdout.write(report.markdown);
    return;
  }

  if (!['run', 'deliver'].includes(command)) {
    throw new Error(`Unsupported command: ${command}`);
  }

  const bundle = await fetchFeedBundle();
  const fallbackReport = buildDeepFounderRadarReport(bundle, radarOptions);
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

function buildRadarOptionsFromEnv(env) {
  return {
    language: env.FOUNDER_RADAR_LANGUAGE || 'zh-CN',
    pruning: {
      x: {
        includeHandles: parseCsvEnv(env.FOUNDER_RADAR_PRUNE_X_INCLUDE_HANDLES).map((item) => item.toLowerCase()),
        excludeHandles: parseCsvEnv(env.FOUNDER_RADAR_PRUNE_X_EXCLUDE_HANDLES).map((item) => item.toLowerCase())
      },
      blog: {
        includeSources: parseCsvEnv(env.FOUNDER_RADAR_PRUNE_BLOG_INCLUDE_SOURCES),
        excludeSources: parseCsvEnv(env.FOUNDER_RADAR_PRUNE_BLOG_EXCLUDE_SOURCES)
      },
      podcast: {
        includeSources: parseCsvEnv(env.FOUNDER_RADAR_PRUNE_PODCAST_INCLUDE_SOURCES),
        excludeSources: parseCsvEnv(env.FOUNDER_RADAR_PRUNE_PODCAST_EXCLUDE_SOURCES)
      },
      max: {
        xCandidates: parseMaxCandidateEnv('FOUNDER_RADAR_PRUNE_MAX_X_CANDIDATES', env.FOUNDER_RADAR_PRUNE_MAX_X_CANDIDATES),
        blogCandidates: parseMaxCandidateEnv('FOUNDER_RADAR_PRUNE_MAX_BLOG_CANDIDATES', env.FOUNDER_RADAR_PRUNE_MAX_BLOG_CANDIDATES),
        podcastCandidates: parseMaxCandidateEnv('FOUNDER_RADAR_PRUNE_MAX_PODCAST_CANDIDATES', env.FOUNDER_RADAR_PRUNE_MAX_PODCAST_CANDIDATES)
      }
    }
  };
}

function parseCsvEnv(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMaxCandidateEnv(name, rawValue) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
    return null;
  }

  const value = String(rawValue).trim();
  if (!/^[+-]?\d+$/.test(value)) {
    throw new Error(`${name} must be an integer`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a safe integer`);
  }

  if (parsed <= 0) {
    return null;
  }

  return parsed;
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
