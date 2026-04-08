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
      bio: 'high-signal non-core source',
      tweets: [
        {
          id: '5',
          text: 'Shipping practical agent workflows with strong distribution and growth loops.',
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
      publishedAt: '2026-04-01T00:00:00.000Z',
      transcript: 'Tool selection accuracy drops when agents have too many tools. Better tool curation wins.'
    },
    {
      source: 'podcast',
      name: 'Unsupervised Learning',
      title: 'Agent reliability deep dive',
      url: 'https://youtube.com/watch?v=unsupervised',
      publishedAt: '2026-04-01T00:00:00.000Z',
      transcript: 'Agent reliability needs review loops and better operational workflows.'
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
      title: 'Startup teams shipping with tiny headcount',
      url: 'https://example.com/random',
      publishedAt: '2026-04-01T01:00:00.000Z',
      author: 'Unknown',
      description: 'High-signal outsider source',
      content: 'Small teams now ship end-to-end agent workflows with explicit review and launch playbooks.'
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

test('keeps all sources by default when pruning is not configured', () => {
  const result = buildFounderRadar(baseInput, {
    language: 'zh-CN',
    style: 'verdict+evidence',
    delivery: 'lark_dm'
  });

  assert.equal(result.sections.topSignals.some((signal) => signal.handle === 'petergyang'), true);
  assert.equal(result.markdown.includes('petergyang'), true);
});

test('supports include and exclude pruning where exclude takes precedence', () => {
  const result = buildFounderRadar(baseInput, {
    language: 'zh-CN',
    style: 'verdict+evidence',
    delivery: 'lark_dm',
    pruning: {
      x: {
        includeHandles: ['petergyang', 'kevinweil'],
        excludeHandles: ['petergyang']
      },
      blog: {
        includeSources: ['Random Blog', 'Claude Blog'],
        excludeSources: ['Random Blog']
      },
      podcast: {
        includeSources: ['Unsupervised Learning', 'Latent Space'],
        excludeSources: ['Unsupervised Learning']
      }
    }
  });

  assert.equal(result.sections.topSignals.some((signal) => signal.handle === 'petergyang'), false);
  assert.equal(result.sections.topSignals.some((signal) => signal.sourceName === 'Random Blog'), false);
  assert.equal(result.sections.topSignals.some((signal) => signal.sourceName === 'Unsupervised Learning'), false);
  assert.equal(result.markdown.includes('petergyang'), false);
  assert.equal(result.markdown.includes('Random Blog'), false);
  assert.equal(result.markdown.includes('Unsupervised Learning'), false);
});

test('applies per-type max candidate pruning after scoring', () => {
  const result = buildFounderRadar(baseInput, {
    language: 'zh-CN',
    style: 'verdict+evidence',
    delivery: 'lark_dm',
    pruning: {
      max: {
        xCandidates: 1,
        blogCandidates: 1,
        podcastCandidates: 1
      }
    }
  });

  const countsByType = result.sections.topSignals.reduce((counts, signal) => {
    counts[signal.type] = (counts[signal.type] || 0) + 1;
    return counts;
  }, {});

  assert.equal(countsByType.x || 0, 1);
  assert.equal(countsByType.blog || 0, 1);
  assert.equal(countsByType.podcast || 0, 1);
});

test('still renders cleanly when podcasts and blogs are empty', () => {
  const result = buildFounderRadar(
    { ...baseInput, podcasts: [], blogs: [] },
    { language: 'zh-CN', style: 'verdict+evidence', delivery: 'lark_dm' }
  );

  assert.match(result.markdown, /## Opportunity Seeds/);
  assert.match(result.markdown, /## Read Next/);
  assert.equal(result.sections.topSignals.length, 5);
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
  assert.match(result.markdown, /https:\/\/x\.com\/.+\/status\/\d+/);
  assert.equal(result.markdown.includes('## Top Signals'), false);
  assert.equal(result.markdown.includes('## Who to Watch'), false);
});

test('drops stale podcast signals that fall outside the daily recency window', () => {
  const result = buildFounderRadar(
    {
      generatedAt: '2026-04-06T07:00:00.000Z',
      x: [
        {
          source: 'x',
          name: 'Fresh Agent',
          handle: 'freshagent',
          bio: 'builder',
          tweets: [
            {
              id: 'fresh-1',
              text: 'Agent workflow automation is finally good enough for real product launches and human review.',
              createdAt: '2026-04-06T05:30:00.000Z',
              url: 'https://x.com/freshagent/status/1',
              likes: 150,
              retweets: 12,
              replies: 8,
              isQuote: false,
              quotedTweetId: null
            }
          ]
        }
      ],
      podcasts: [
        {
          source: 'podcast',
          name: 'Aging Podcast',
          title: 'A stale episode with a very long transcript',
          url: 'https://example.com/podcast/stale',
          publishedAt: '2026-04-02T00:00:00.000Z',
          transcript: buildUniqueWordTranscript(900)
        }
      ],
      blogs: []
    },
    { language: 'zh-CN', style: 'verdict+evidence', delivery: 'lark_dm' }
  );

  assert.equal(result.sections.topSignals.some((signal) => signal.type === 'podcast'), false);
  assert.equal(result.sections.topSignals[0]?.handle, 'freshagent');
});

test('uses a 24 hour default recency window across x blogs and podcasts', () => {
  const result = buildFounderRadar(
    {
      generatedAt: '2026-04-07T07:00:00.000Z',
      x: [
        buildAccount({
          name: 'Fresh X',
          handle: 'freshx',
          text: 'Agent workflows are shipping into production with human review.',
          createdAt: '2026-04-07T01:00:00.000Z',
          likes: 120,
          retweets: 10,
          replies: 7
        }),
        buildAccount({
          name: 'Old X',
          handle: 'oldx',
          text: 'Yesterday still matters but should fall out after twenty four hours.',
          createdAt: '2026-04-06T06:00:00.000Z',
          likes: 500,
          retweets: 50,
          replies: 40
        })
      ],
      blogs: [
        {
          source: 'blog',
          name: 'Fresh Blog',
          title: 'Fresh launch note',
          url: 'https://example.com/fresh-blog',
          publishedAt: '2026-04-06T23:00:00.000Z',
          author: 'Writer',
          description: 'Fresh',
          content: 'Product teams are launching with stronger workflows today.'
        },
        {
          source: 'blog',
          name: 'Old Blog',
          title: 'Old launch note',
          url: 'https://example.com/old-blog',
          publishedAt: '2026-04-06T05:59:00.000Z',
          author: 'Writer',
          description: 'Old',
          content: 'This blog is more than twenty four hours old and should be excluded.'
        }
      ],
      podcasts: [
        {
          source: 'podcast',
          name: 'Fresh Podcast',
          title: 'Fresh podcast note',
          url: 'https://example.com/fresh-podcast',
          publishedAt: '2026-04-06T20:00:00.000Z',
          transcript: 'Fresh signal about agent workflow delivery.'
        },
        {
          source: 'podcast',
          name: 'Old Podcast',
          title: 'Old podcast note',
          url: 'https://example.com/old-podcast',
          publishedAt: '2026-04-06T04:30:00.000Z',
          transcript: 'This transcript is older than twenty four hours and should not appear.'
        }
      ]
    },
    { language: 'zh-CN', style: 'verdict+evidence', delivery: 'lark_dm' }
  );

  assert.equal(result.sections.topSignals.some((signal) => signal.handle === 'oldx'), false);
  assert.equal(result.sections.topSignals.some((signal) => signal.sourceName === 'Old Blog'), false);
  assert.equal(result.sections.topSignals.some((signal) => signal.sourceName === 'Old Podcast'), false);
  assert.equal(result.sections.topSignals.some((signal) => signal.handle === 'freshx'), true);
  assert.equal(result.sections.topSignals.some((signal) => signal.sourceName === 'Fresh Blog'), true);
  assert.equal(result.sections.topSignals.some((signal) => signal.sourceName === 'Fresh Podcast'), true);
});

test('uses theme-relevant evidence when expanding each daily verdict', () => {
  const result = buildDeepFounderRadarReport(
    {
      generatedAt: '2026-04-06T07:00:00.000Z',
      x: [
        buildAccount({
          name: 'Agent Alpha',
          handle: 'agentalpha',
          text: 'Agent workflow automation improves code review reliability for production handoffs.',
          createdAt: '2026-04-06T06:10:00.000Z',
          likes: 220,
          retweets: 18,
          replies: 12
        }),
        buildAccount({
          name: 'Growth Beta',
          handle: 'growthbeta',
          text: 'Shipping product launch systems creates stronger growth loops for teams.',
          createdAt: '2026-04-06T05:55:00.000Z',
          likes: 180,
          retweets: 16,
          replies: 11
        }),
        buildAccount({
          name: 'Research Gamma',
          handle: 'researchgamma',
          text: 'Model research and better proofs are resetting the bar for applied products.',
          createdAt: '2026-04-06T05:10:00.000Z',
          likes: 40,
          retweets: 5,
          replies: 4
        }),
        buildAccount({
          name: 'Team Delta',
          handle: 'teamdelta',
          text: 'Startup founder teams are learning to do more with fewer people.',
          createdAt: '2026-04-06T04:45:00.000Z',
          likes: 35,
          retweets: 4,
          replies: 3
        })
      ],
      podcasts: [],
      blogs: []
    },
    { language: 'zh-CN' }
  );

  assert.match(result.sections.todayVerdict[1], /Research Gamma \(@researchgamma\)/);
});

function buildAccount({ name, handle, text, createdAt, likes, retweets, replies }) {
  return {
    source: 'x',
    name,
    handle,
    bio: 'builder',
    tweets: [
      {
        id: `${handle}-1`,
        text,
        createdAt,
        url: `https://x.com/${handle}/status/1`,
        likes,
        retweets,
        replies,
        isQuote: false,
        quotedTweetId: null
      }
    ]
  };
}

function buildUniqueWordTranscript(size) {
  const keywords = ['agent', 'workflow', 'model', 'research', 'team', 'startup', 'product', 'launch', 'shipping'];
  const filler = Array.from({ length: size }, (_, index) => `topic${index}`);
  return [...keywords, ...filler].join(' ');
}
