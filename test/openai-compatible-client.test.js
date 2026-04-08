import test from 'node:test';
import assert from 'node:assert/strict';

import { createOpenAiCompatibleClient } from '../src/llm/openai-compatible-client.js';
import { buildDeepFounderRadarReport } from '../src/radar/build-founder-radar.js';

test('enrichDigestReport prompts the model with raw top-signal cards instead of fallback verdict prose', async () => {
  let requestBody;
  const fallbackReport = buildDeepFounderRadarReport(
    {
      generatedAt: '2026-04-07T07:00:00.000Z',
      x: [
        buildAccount({
          name: 'Workflow Ops',
          handle: 'workflowops',
          text: 'Teams are standardizing agent review handoff tooling and orchestration around production code changes.',
          createdAt: '2026-04-07T06:20:00.000Z',
          likes: 280,
          retweets: 22,
          replies: 17
        }),
        buildAccount({
          name: 'Proof Lab',
          handle: 'prooflab',
          text: 'Elegant proofs and model research are changing what product teams think should be solvable this quarter.',
          createdAt: '2026-04-07T06:15:00.000Z',
          likes: 300,
          retweets: 25,
          replies: 18
        })
      ],
      blogs: [
        {
          source: 'blog',
          name: 'Launch Blog',
          title: 'Distribution loops now decide who compounds',
          url: 'https://example.com/launch-blog',
          publishedAt: '2026-04-07T05:10:00.000Z',
          author: 'Writer',
          description: 'Launch analysis',
          content: 'Launch windows, product packaging, and pricing loops are deciding who compounds distribution.'
        }
      ],
      podcasts: []
    },
    { language: 'zh-CN' }
  );

  const client = createOpenAiCompatibleClient({
    apiKey: 'test-key',
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        async json() {
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: fallbackReport.title,
                    intro: fallbackReport.intro,
                    sections: fallbackReport.sections
                  })
                }
              }
            ]
          };
        }
      };
    }
  });

  await client.enrichDigestReport(fallbackReport);

  const prompt = requestBody.messages[1].content;
  const topSignal = fallbackReport.brief.sections.topSignals[0];

  assert.match(prompt, /todayVerdict.*3.*signal-explicit/i);
  assert.match(prompt, /Top signal/i);
  assert.match(prompt, new RegExp(escapeRegExp(topSignal.sourceName)));
  assert.match(prompt, new RegExp(escapeRegExp(topSignal.summary)));
  assert.match(prompt, new RegExp(escapeRegExp(topSignal.evidence)));
  assert.match(prompt, new RegExp(escapeRegExp(topSignal.url)));
  assert.equal(prompt.includes(fallbackReport.markdown), false);
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
