import { readFile } from 'node:fs/promises';

import { buildFounderRadar } from './radar/build-founder-radar.js';

const FEED_BASE_URL = process.env.FOLLOW_BUILDERS_FEED_BASE_URL
  || 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main';

async function main() {
  const [command = 'run'] = process.argv.slice(2);

  if (command === 'smoke') {
    const fixtureInput = JSON.parse(
      await readFile(new URL('../test/fixtures/smoke-bundle.json', import.meta.url), 'utf-8')
    );
    const report = buildFounderRadar(fixtureInput, {
      language: 'zh-CN',
      style: 'verdict+evidence',
      delivery: 'lark_dm'
    });
    process.stdout.write(report.markdown);
    return;
  }

  if (command !== 'run') {
    throw new Error(`Unsupported command: ${command}`);
  }

  const bundle = await fetchFeedBundle();
  const report = buildFounderRadar(bundle, {
    language: process.env.FOUNDER_RADAR_LANGUAGE || 'zh-CN',
    style: 'verdict+evidence',
    delivery: 'lark_dm'
  });

  process.stdout.write(report.markdown);
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
