import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDeepFounderRadarReport, buildFounderRadar } from '../src/radar/build-founder-radar.js';

const baseInput = {
  generatedAt: '2026-04-01T07:18:03.375Z',
  x: [
    {
      source: 'x',
      name: 'Swyx',
      handle: 'swyx',
      bio: 'builder',
      tweets: [
        {
          id: '1',
          text: 'Codex growth stalled in March and builders are noticing.',
          createdAt: '2026-04-01T06:03:43.000Z',
          url: 'https://x.com/swyx/status/1',
          likes: 6,
          retweets: 0,
          replies: 3,
          isQuote: false,
          quotedTweetId: null
        }
      ]
    },
    {
      source: 'x',
      name: 'Kevin Weil',
      handle: 'kevinweil',
      bio: 'VP Science @OpenAI',
      tweets: [
        {
          id: '2',
          text: 'AI is solving more open problems and the proofs are getting more elegant.',
          createdAt: '2026-04-01T04:38:05.000Z',
          url: 'https://x.com/kevinweil/status/2',
          likes: 116,
          retweets: 7,
          replies: 18,
          isQuote: true,
          quotedTweetId: '22'
        }
      ]
    },
    {
      source: 'x',
      name: 'Amjad Masad',
      handle: 'amasad',
      bio: 'CEO @replit',
      tweets: [
        {
          id: '3',
          text: 'New psyop just dropped around agentic coding workflows.',
          createdAt: '2026-04-01T04:12:59.000Z',
          url: 'https://x.com/amasad/status/3',
          likes: 259,
          retweets: 29,
          replies: 26,
          isQuote: true,
          quotedTweetId: '33'
        }
      ]
    },
    {
      source: 'x',
      name: 'Garry Tan',
      handle: 'garrytan',
      bio: 'President & CEO @ycombinator',
      tweets: [
        {
          id: '4',
          text: 'YC founders are shipping with much smaller teams than a year ago.',
          createdAt: '2026-04-01T07:17:02.000Z',
          url: 'https://x.com/garrytan/status/4',
          likes: 40,
          retweets: 4,
          replies: 5,
          isQuote: false,
          quotedTweetId: null
        }
      ]
    },
    {
      source: 'x',
      name: 'Peter Yang',
      handle: 'petergyang',
      bio: 'excluded from the founder radar core set',
      tweets: [
        {
          id: '5',
          text: 'This should never appear because the core source filter excludes me.',
          createdAt: '2026-04-01T04:00:00.000Z',
          url: 'https://x.com/petergyang/status/5',
          likes: 999,
          retweets: 99,
          replies: 88,
          isQuote: false,
          quotedTweetId: null
        }
      ]
    }
  ],
  podcasts: [
    {
      source: 'podcast',
      name: 'Latent Space',
      title: 'Why agents keep failing and what tool curation fixes',
      url: 'https://youtube.com/watch?v=latent-space',
      publishedAt: '2026-03-31T00:00:00.000Z',
      transcript: 'Tool selection accuracy drops when agents have too many tools. Better tool curation wins.'
    },
    {
      source: 'podcast',
      name: 'Unsupervised Learning',
      title: 'This should be filtered out',
      url: 'https://youtube.com/watch?v=unsupervised',
      publishedAt: '2026-03-31T00:00:00.000Z',
      transcript: 'Not in the founder radar core set.'
    }
  ],
  blogs: [
    {
      source: 'blog',
      name: 'Claude Blog',
      title: 'Claude ships a faster agent workflow',
      url: 'https://claude.com/blog/faster-agent-workflow',
      publishedAt: '2026-04-01T01:00:00.000Z',
      author: 'Anthropic',
      description: 'Workflow update',
      content: 'Claude ships a faster agent workflow with better tool use and more reliable reviews.'
    },
    {
      source: 'blog',
      name: 'Random Blog',
      title: 'This should be filtered out',
      url: 'https://example.com/random',
      publishedAt: '2026-04-01T01:00:00.000Z',
      author: 'Unknown',
      description: 'Filtered',
      content: 'Not in the approved core set.'
    }
  ]
};

test('renders the fixed founder radar sections with evidence links', () => {
  const result = buildFounderRadar(baseInput, {
    language: 'zh-CN',
    style: 'verdict+evidence',
    delivery: 'lark_dm'
  });

  assert.match(result.markdown, /# Founder Radar/);
  assert.match(result.markdown, /## 今日判断/);
  assert.match(result.markdown, /## Top Signals/);
  assert.match(result.markdown, /## Who to Watch/);
  assert.match(result.markdown, /## Opportunity Seeds/);
  assert.match(result.markdown, /## Read Next/);

  assert.equal(result.sections.topSignals.length, 5);
  for (const signal of result.sections.topSignals) {
    assert.ok(signal.url.startsWith('https://'));
  }
});

test('keeps only the approved core source subset', () => {
  const result = buildFounderRadar(baseInput, {
    language: 'zh-CN',
    style: 'verdict+evidence',
    delivery: 'lark_dm'
  });

  assert.equal(result.sections.topSignals.some((signal) => signal.handle === 'petergyang'), false);
  assert.equal(result.markdown.includes('petergyang'), false);
  assert.equal(result.markdown.includes('Unsupervised Learning'), false);
  assert.equal(result.markdown.includes('Random Blog'), false);
});

test('still renders cleanly when podcasts and blogs are empty', () => {
  const result = buildFounderRadar(
    { ...baseInput, podcasts: [], blogs: [] },
    { language: 'zh-CN', style: 'verdict+evidence', delivery: 'lark_dm' }
  );

  assert.match(result.markdown, /## Opportunity Seeds/);
  assert.match(result.markdown, /## Read Next/);
  assert.equal(result.sections.topSignals.length, 4);
});

test('collapses repeated tweets from the same builder into one signal', () => {
  const result = buildFounderRadar(
    {
      ...baseInput,
      x: [
        ...baseInput.x,
        {
          source: 'x',
          name: 'Amjad Masad',
          handle: 'amasad',
          bio: 'CEO @replit',
          tweets: [
            {
              id: '6',
              text: 'Another high-signal note about coding agents and product velocity.',
              createdAt: '2026-04-01T05:12:59.000Z',
              url: 'https://x.com/amasad/status/6',
              likes: 300,
              retweets: 30,
              replies: 20,
              isQuote: false,
              quotedTweetId: null
            }
          ]
        }
      ]
    },
    { language: 'zh-CN', style: 'verdict+evidence', delivery: 'lark_dm' }
  );

  const amjadSignals = result.sections.topSignals.filter((signal) => signal.handle === 'amasad');
  assert.equal(amjadSignals.length, 1);
});

test('is deterministic across repeated runs of the same feed bundle', () => {
  const first = buildFounderRadar(baseInput, {
    language: 'zh-CN',
    style: 'verdict+evidence',
    delivery: 'lark_dm'
  });
  const second = buildFounderRadar(baseInput, {
    language: 'zh-CN',
    style: 'verdict+evidence',
    delivery: 'lark_dm'
  });

  assert.deepEqual(second, first);
});

test('builds a long-form Chinese digest with fixed sections and source links', () => {
  const result = buildDeepFounderRadarReport(baseInput, {
    language: 'zh-CN'
  });

  assert.match(result.markdown, /# Founder Radar 深度日报/);
  assert.match(result.markdown, /## 今日结论/);
  assert.match(result.markdown, /## 核心论证/);
  assert.match(result.markdown, /## 反论点与不确定性/);
  assert.match(result.markdown, /## 创始人行动建议/);
  assert.match(result.markdown, /## 延伸阅读/);
  assert.ok(result.markdown.length > 1800);
  assert.match(result.markdown, /https:\/\/x\.com\/kevinweil\/status\/2/);
  assert.equal(result.markdown.includes('## Top Signals'), false);
  assert.equal(result.markdown.includes('## Who to Watch'), false);
});
