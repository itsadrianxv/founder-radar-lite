import {
  CORE_BLOG_SOURCES,
  CORE_PODCAST_SOURCES,
  CORE_X_SOURCES
} from '../config/core-sources.js';

const SOURCE_PRIORITY = {
  x: 3,
  blog: 2,
  podcast: 1
};

const THEME_RULES = [
  { tag: 'agents', keywords: ['agent', 'agents', 'tool', 'workflow', 'automation', 'coding'] },
  { tag: 'research', keywords: ['proof', 'research', 'science', 'model', 'open problems'] },
  { tag: 'teams', keywords: ['team', 'teams', 'founder', 'startup', 'yc', 'company'] },
  { tag: 'distribution', keywords: ['growth', 'launch', 'ship', 'shipping', 'product'] }
];

export function buildFounderRadar(input, options = {}) {
  const normalizedOptions = {
    language: options.language || 'zh-CN',
    style: options.style || 'verdict+evidence',
    delivery: options.delivery || 'lark_dm'
  };

  const candidates = collectCandidates(input);
  const scoredSignals = candidates
    .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate) }))
    .sort(compareSignals);

  const topSignals = scoredSignals.slice(0, 5);
  const whoToWatch = buildWhoToWatch(scoredSignals);
  const opportunities = buildOpportunitySeeds(topSignals, whoToWatch);
  const verdicts = buildVerdicts(topSignals);
  const readNext = buildReadNext(topSignals, scoredSignals);
  const markdown = renderMarkdown({
    generatedAt: input.generatedAt,
    verdicts,
    topSignals,
    whoToWatch,
    opportunities,
    readNext
  });

  return {
    options: normalizedOptions,
    markdown,
    sections: {
      verdicts,
      topSignals,
      whoToWatch,
      opportunities,
      readNext
    }
  };
}

function collectCandidates(input) {
  const groupedAccounts = new Map();
  for (const account of input.x || []) {
    if (!Object.hasOwn(CORE_X_SOURCES, account.handle)) continue;
    const current = groupedAccounts.get(account.handle) || {
      sourceName: account.name,
      handle: account.handle,
      tweets: []
    };
    current.tweets.push(...(account.tweets || []));
    groupedAccounts.set(account.handle, current);
  }

  const xCandidates = [...groupedAccounts.values()].map((account) => {
    const rankedTweets = [...account.tweets].sort((left, right) => {
      const leftScore = (left.likes || 0) + (left.retweets || 0) * 2 + (left.replies || 0);
      const rightScore = (right.likes || 0) + (right.retweets || 0) * 2 + (right.replies || 0);
      return rightScore - leftScore || String(right.createdAt).localeCompare(String(left.createdAt));
    });
    const leadTweet = rankedTweets[0];
    const combinedText = rankedTweets.map((tweet) => tweet.text).join(' ');

    return {
      type: 'x',
      sourceName: account.sourceName,
      handle: account.handle,
      title: `${account.sourceName} 在 X 上的更新`,
      summary: summarizeText(leadTweet.text, 180),
      evidence: summarizeText(combinedText, 140),
      url: leadTweet.url,
      publishedAt: leadTweet.createdAt,
      weight: CORE_X_SOURCES[account.handle],
      themeTags: inferThemeTags(combinedText),
      engagement: rankedTweets.reduce(
        (sum, tweet) => sum + (tweet.likes || 0) + (tweet.retweets || 0) * 2 + (tweet.replies || 0),
        0
      ),
      rawText: combinedText
    };
  });

  const blogCandidates = (input.blogs || [])
    .filter((blog) => CORE_BLOG_SOURCES.has(blog.name))
    .map((blog) => {
      const text = `${blog.title} ${blog.description || ''} ${blog.content || ''}`.trim();
      return {
        type: 'blog',
        sourceName: blog.name,
        handle: null,
        title: blog.title,
        summary: summarizeText(text, 180),
        evidence: summarizeText(blog.content || blog.description || blog.title, 140),
        url: blog.url,
        publishedAt: blog.publishedAt,
        weight: blog.name === 'Anthropic Engineering' ? 9 : 8,
        themeTags: inferThemeTags(text),
        engagement: 40,
        rawText: text
      };
    });

  const podcastCandidates = (input.podcasts || [])
    .filter((podcast) => CORE_PODCAST_SOURCES.has(podcast.name))
    .map((podcast) => {
      const text = `${podcast.title} ${podcast.transcript || ''}`.trim();
      return {
        type: 'podcast',
        sourceName: podcast.name,
        handle: null,
        title: podcast.title,
        summary: summarizeText(text, 180),
        evidence: summarizeText(podcast.transcript || podcast.title, 140),
        url: podcast.url,
        publishedAt: podcast.publishedAt,
        weight: podcast.name === 'Latent Space' ? 8 : 7,
        themeTags: inferThemeTags(text),
        engagement: 25,
        rawText: text
      };
    });

  return [...xCandidates, ...blogCandidates, ...podcastCandidates];
}

function scoreCandidate(candidate) {
  const novelty = countUniqueMeaningfulWords(candidate.rawText) / 6;
  const productRelevance = candidate.themeTags.some((tag) => tag === 'agents' || tag === 'distribution') ? 6 : 3;
  const marketSignal = candidate.themeTags.includes('teams') ? 5 : 2;
  const evidenceRichness = Math.min(candidate.evidence.length / 40, 5);
  const engagementBoost = Math.min(candidate.engagement / 50, 6);

  return (
    candidate.weight * 4 +
    novelty +
    productRelevance +
    marketSignal +
    evidenceRichness +
    engagementBoost
  );
}

function compareSignals(left, right) {
  return (
    right.score - left.score ||
    SOURCE_PRIORITY[right.type] - SOURCE_PRIORITY[left.type] ||
    String(right.publishedAt).localeCompare(String(left.publishedAt)) ||
    left.url.localeCompare(right.url)
  );
}

function buildVerdicts(topSignals) {
  const themeCounts = countThemes(topSignals);
  const sortedThemes = Object.entries(themeCounts).sort((left, right) => right[1] - left[1]);
  const verdicts = [];

  if (themeCounts.agents) {
    verdicts.push('Agent 工作流仍是今天最强的产品叙事，讨论重心集中在工具编排、自动化交付与效率放大。');
  }
  if (themeCounts.research) {
    verdicts.push('前沿模型能力仍在向“更强问题求解 + 更优雅证明”延伸，研究进展正在反向抬升产品预期。');
  }
  if (themeCounts.teams || themeCounts.distribution) {
    verdicts.push('小团队高杠杆创业继续强化：创始人和产品负责人都在默认接受“更少人做更多事”。');
  }

  while (verdicts.length < 3) {
    const tag = sortedThemes[verdicts.length]?.[0];
    verdicts.push(fallbackVerdict(tag));
  }

  return verdicts.slice(0, 3);
}

function fallbackVerdict(tag) {
  switch (tag) {
    case 'distribution':
      return '今天的明确信号不是新模型，而是谁能更快把能力包装成可传播、可转化的产品体验。';
    case 'teams':
      return '组织边界继续被压缩，值得关注的是谁先把“单人团队 + 智能流程”做成默认工作方式。';
    default:
      return '今天最值得看的是构建者们如何把模型能力变成具体的产品动作，而不是抽象观点。';
  }
}

function buildWhoToWatch(scoredSignals) {
  const picks = [];
  const seen = new Set();

  for (const signal of scoredSignals) {
    const key = signal.handle || signal.sourceName;
    if (seen.has(key)) continue;
    seen.add(key);
    picks.push({
      name: signal.sourceName,
      handle: signal.handle,
      reason: buildWatchReason(signal),
      url: signal.url
    });
    if (picks.length === 2) break;
  }

  return picks;
}

function buildWatchReason(signal) {
  if (signal.handle === 'kevinweil') {
    return '既能代表前沿实验室视角，也在把研究信号翻译成产品和市场预期。';
  }
  if (signal.handle === 'amasad') {
    return '持续站在 agentic coding 的第一线，适合观察开发者工具会往哪里卷。';
  }
  if (signal.handle === 'garrytan') {
    return 'YC 视角能更早暴露创业团队配置和融资叙事的变化。';
  }
  if (signal.type === 'blog') {
    return '官方博客往往比社交平台更早给出“真正已经上线的能力边界”。';
  }
  if (signal.type === 'podcast') {
    return '长播客最容易暴露产品路线和组织打法，适合做深度跟踪。';
  }
  return '这是今天盘面里最值得持续追踪的高信号构建者之一。';
}

function buildOpportunitySeeds(topSignals, whoToWatch) {
  const primaryTheme = mostCommonTheme(topSignals);
  const leadingNames = whoToWatch.map((item) => item.name).join('、');

  return [
    {
      category: '创业',
      headline: '把“agent 编排 + 审核 + 发布”做成更可信的工作台',
      rationale: primaryTheme === 'agents'
        ? '今天多条信号都在指向 agent 工作流落地，机会不是再做一个通用助手，而是把高频垂直流程做得更可控。'
        : '高信号内容集中在产品交付效率，适合寻找具体团队里最先被自动化替代的那层中间流程。'
    },
    {
      category: '职业',
      headline: `优先靠近 ${leadingNames || '最会把模型能力落成产品的人'}`,
      rationale: '下一波高杠杆岗位，会出现在把研究、产品和交付速度绑在一起的团队，而不是只做概念包装的团队。'
    },
    {
      category: '投资',
      headline: '继续盯住“小团队高产出”相关工具和基础设施',
      rationale: '如果创始人越来越相信少人团队能放大产出，那么围绕评审、部署、可观测性和合规的配套层会持续受益。'
    }
  ];
}

function buildReadNext(topSignals, scoredSignals) {
  const urls = [];
  const seen = new Set();
  for (const signal of [...topSignals, ...scoredSignals]) {
    if (seen.has(signal.url)) continue;
    seen.add(signal.url);
    urls.push(signal.url);
    if (urls.length === 5) break;
  }
  return urls;
}

function renderMarkdown({ generatedAt, verdicts, topSignals, whoToWatch, opportunities, readNext }) {
  const dateLabel = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai'
  }).format(new Date(generatedAt || Date.now()));

  const topSignalLines = topSignals.map((signal, index) => {
    const actor = signal.handle ? `${signal.sourceName} (@${signal.handle})` : signal.sourceName;
    return `${index + 1}. **${actor}**\n   - 发生了什么：${signal.summary}\n   - 为什么重要：${buildImportanceLine(signal)}\n   - 原链接：${signal.url}`;
  });

  const watchLines = whoToWatch.map((item, index) => {
    const actor = item.handle ? `${item.name} (@${item.handle})` : item.name;
    return `${index + 1}. **${actor}**：${item.reason} ${item.url}`;
  });

  const opportunityLines = opportunities.map((item, index) => (
    `${index + 1}. **${item.category}**｜${item.headline}\n   - ${item.rationale}`
  ));

  const readNextLines = readNext.map((url, index) => `${index + 1}. ${url}`);

  return [
    `# Founder Radar · ${dateLabel}`,
    '',
    '## 今日判断',
    ...verdicts.map((line) => `- ${line}`),
    '',
    '## Top Signals',
    ...topSignalLines,
    '',
    '## Who to Watch',
    ...watchLines,
    '',
    '## Opportunity Seeds',
    ...opportunityLines,
    '',
    '## Read Next',
    ...readNextLines,
    ''
  ].join('\n');
}

function buildImportanceLine(signal) {
  if (signal.themeTags.includes('agents')) {
    return '它直接反映了 agent 工作流、工具编排或自动化交付正在怎样进入真实产品栈。';
  }
  if (signal.themeTags.includes('research')) {
    return '它说明前沿能力还在上行，下一轮产品预期和市场故事会继续被抬高。';
  }
  if (signal.themeTags.includes('teams')) {
    return '它强化了“小团队更高产出”的共识，意味着组织与工具都会继续重构。';
  }
  return '它属于今天最值得保留上下文的一条高信号，因为它把观点和行动联系在了一起。';
}

function countThemes(signals) {
  const counts = { agents: 0, research: 0, teams: 0, distribution: 0 };
  for (const signal of signals) {
    for (const tag of signal.themeTags) {
      counts[tag] += 1;
    }
  }
  return counts;
}

function mostCommonTheme(signals) {
  const counts = countThemes(signals);
  return Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] || 'agents';
}

function inferThemeTags(text) {
  const lowered = String(text || '').toLowerCase();
  const tags = THEME_RULES
    .filter((rule) => rule.keywords.some((keyword) => lowered.includes(keyword)))
    .map((rule) => rule.tag);
  return tags.length > 0 ? tags : ['distribution'];
}

function summarizeText(text, maxLength) {
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\[[^\]]+\]/g, '')
    .trim();

  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}

function countUniqueMeaningfulWords(text) {
  const words = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3);

  return new Set(words).size;
}
