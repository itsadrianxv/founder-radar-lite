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

export function buildDeepFounderRadarReport(input, options = {}) {
  const brief = buildFounderRadar(input, options);
  const dateLabel = formatReportDate(input.generatedAt);
  const topSignals = brief.sections.topSignals;
  const whoToWatch = brief.sections.whoToWatch;
  const opportunities = brief.sections.opportunities;
  const report = {
    title: `Founder Radar 深度日报｜${dateLabel}`,
    intro: `这份深度日报继续以 follow-builders 为核心信号输入，只保留本仓库定义的高信号构建者与内容源。今天进入视野的重点，不是单条新闻本身，而是这些信号共同描出的组织、工作流与分发变化：构建者已经开始把模型能力从“能展示”推进到“能交付、能审核、能复盘”。`,
    sections: {
      todayVerdict: brief.sections.verdicts.map((verdict, index) => expandVerdict(verdict, topSignals, opportunities[index])),
      coreArguments: buildCoreArguments(topSignals),
      counterpoints: buildCounterpoints(topSignals),
      actionItems: buildActionItems(opportunities, whoToWatch),
      readNext: buildReadNextLinks(topSignals, brief.sections.readNext)
    }
  };

  return {
    ...report,
    brief,
    markdown: renderDeepDigestMarkdown(report)
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

function formatReportDate(generatedAt) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai'
  }).format(new Date(generatedAt || Date.now()));
}

function buildActorLabel(signal) {
  return signal.handle ? `${signal.sourceName} (@${signal.handle})` : signal.sourceName;
}

function expandVerdict(verdict, topSignals, opportunity) {
  const referencedActors = topSignals
    .slice(0, 2)
    .map((signal) => buildActorLabel(signal))
    .join('、');
  const opportunityLine = opportunity
    ? `从行动层面看，最值得先试的方向是“${opportunity.headline}”，因为它最接近今天这组信号真正指向的交付瓶颈。`
    : '从行动层面看，最重要的不是继续收集观点，而是找出你团队里最值得被产品化的一条关键链路。';

  return `${verdict} 更具体地说，今天最强的证据不是孤立出现的，而是由 ${referencedActors || '多位核心信号源'} 一起拼出来的同一幅图景：大家都在把 AI 能力往真实工作流、团队杠杆和产品交付上压。${opportunityLine}`;
}

function buildCoreArguments(topSignals) {
  const agentSignals = pickSignalsByTheme(topSignals, 'agents', 3);
  const researchSignals = pickSignalsByTheme(topSignals, 'research', 2);
  const teamSignals = pickSignalsByTheme(topSignals, 'teams', 2);
  const distributionSignals = pickSignalsByTheme(topSignals, 'distribution', 2);

  return [
    {
      title: '论证一：agent 工作流已经从概念展示走向交付基础设施',
      paragraphs: [
        `今天最值得警惕的误判，是把 agent 讨论继续理解成“又一个会写代码、会回答问题的演示”。从 ${agentSignals.map((signal) => buildActorLabel(signal)).join('、') || topSignals.map((signal) => buildActorLabel(signal)).slice(0, 2).join('、')} 这些信号可以看出，真正被反复强调的是工具挑选、审核机制、交付稳定性和流程闭环。也就是说，产品竞争焦点已经开始从模型能不能做，切换成整条链路能不能稳定交付。`,
        `这类变化会改变创业判断：下一批更有机会跑出来的产品，不一定是“最通用”的助手，而更可能是那些把生成、审核、发布、复盘做成默认工作台的产品。谁先把高频任务里的摩擦拿掉，谁就更有机会把模型能力变成组织习惯。`
      ],
      citations: agentSignals.map((signal) => ({
        label: buildActorLabel(signal),
        url: signal.url
      }))
    },
    {
      title: '论证二：研究与产品叙事正在互相抬高彼此的上限',
      paragraphs: [
        `像 ${researchSignals.map((signal) => buildActorLabel(signal)).join('、') || buildActorLabel(topSignals[0])} 这样的信号提醒我们，前沿进展不再只是实验室新闻。它们会直接改变用户的心理标尺：当大家看到模型能解决更难的问题、给出更优雅的结果，就会更自然地期待产品也该更可靠、更可解释、更能承担复杂任务。`,
        `这会把很多表面上看起来是“产品优化”的工作，重新定义成“预期管理”。如果产品只会展示更强的模型，却没有把能力翻译成更稳定的体验和更易接手的协作方式，那么高预期最后只会变成高失望。`
      ],
      citations: researchSignals.map((signal) => ({
        label: buildActorLabel(signal),
        url: signal.url
      }))
    },
    {
      title: '论证三：小团队高杠杆会把更多价值推向中间层能力',
      paragraphs: [
        `无论是 ${teamSignals.map((signal) => buildActorLabel(signal)).join('、') || distributionSignals.map((signal) => buildActorLabel(signal)).join('、') || buildActorLabel(topSignals.at(-1))} 这样的团队/分发信号，还是今天机会种子里反复出现的“工作流闭环”，都在指向同一个结论：小团队要想真的做出更大产出，关键不只是多一个模型接口，而是要把权限、审阅、观测、回滚和复盘一起做扎实。`,
        `换句话说，真正稀缺的不是一句“AI 会提升效率”，而是那些能在真实组织里被持续使用的中间层能力。它们不一定最显眼，却最接近企业愿意持续付费和团队愿意长期迁移的理由。`
      ],
      citations: [...teamSignals, ...distributionSignals].slice(0, 3).map((signal) => ({
        label: buildActorLabel(signal),
        url: signal.url
      }))
    }
  ];
}

function buildCounterpoints(topSignals) {
  const firstActor = topSignals[0] ? buildActorLabel(topSignals[0]) : '今天的头部信号';
  const secondActor = topSignals[1] ? buildActorLabel(topSignals[1]) : '另一类高热度讨论';

  return [
    `第一，今天的高信号样本天然偏向愿意公开表达、愿意强化叙事的人群。${firstActor} 和 ${secondActor} 代表的是最前沿、最主动塑造预期的一批构建者，而不是整个市场的平均面貌。所以如果你直接把这组内容理解成“所有团队都已经完成组织升级”，很容易高估实际落地速度。`,
    '第二，长工作流并不会天然带来更高价值。只要审核、权限和回滚机制没有同时升级，agent 只会更快地产生更多未经验证的内容。真正值得押注的，不是更长的自动化链条，而是那些在关键节点上能让人类更容易判断、接手和纠错的系统设计。'
  ];
}

function buildActionItems(opportunities, whoToWatch) {
  const watchNames = whoToWatch.map((item) => item.name).join('、') || '今天最强的几位构建者';

  return [
    {
      title: `动作一：先找出你团队里最值得被产品化的一条关键链路`,
      paragraphs: [
        `今天最不该做的事，是再次从“我要不要做一个通用助手”开始。更好的起点，是从你团队已经重复发生、而且必须经过审核的那条链路开始下刀，比如“信息收集 → 初稿生成 → 人工审核 → 对外发布”。只要这条链路能做出稳定感，你就已经比绝大多数只停留在能力展示层的产品更接近真实价值。`
      ]
    },
    {
      title: '动作二：把默认输出格式升级成“结论 + 证据 + 风险”',
      paragraphs: [
        `如果模型已经要进入日常工作流，组织真正需要的不是更多文本，而是更容易被判断的文本。你可以要求所有 AI 产出都必须带上结论、证据链接和风险提示，这会显著降低团队对模型结果的心理阻力，也更容易把结果交接给下一位同事。`
      ]
    },
    {
      title: `动作三：持续跟踪 ${watchNames}，但重点研究他们背后的组织打法`,
      paragraphs: [
        `值得跟踪的不是谁又说了一句漂亮观点，而是谁在持续把研究、产品、交付和分发绑定成一套打法。关注这些人时，优先记录他们如何组织团队、怎样定义审核边界、哪些环节仍然保留人工决策。这些信息比单条热帖更接近你真正可以复用的方法。`
      ]
    }
  ];
}

function buildReadNextLinks(topSignals, urls) {
  const labelsByUrl = new Map(topSignals.map((signal) => [signal.url, buildActorLabel(signal)]));
  return urls.map((url, index) => ({
    label: labelsByUrl.get(url) || `延伸阅读 ${index + 1}`,
    url
  }));
}

function pickSignalsByTheme(signals, theme, count) {
  const themedSignals = signals.filter((signal) => signal.themeTags.includes(theme));
  if (themedSignals.length >= count) {
    return themedSignals.slice(0, count);
  }

  const fallbackSignals = [...themedSignals];
  for (const signal of signals) {
    if (fallbackSignals.length >= count) break;
    if (fallbackSignals.some((item) => item.url === signal.url)) continue;
    fallbackSignals.push(signal);
  }

  return fallbackSignals.slice(0, count);
}

export function renderDeepDigestMarkdown(report) {
  const verdictLines = report.sections.todayVerdict.map((item, index) => `${index + 1}. ${item}`);
  const argumentLines = report.sections.coreArguments.flatMap((argument) => {
    const citationLines = argument.citations.map((citation) => `- ${citation.label}：${citation.url}`);
    return [
      `### ${argument.title}`,
      '',
      ...argument.paragraphs,
      '',
      '证据链接：',
      ...citationLines,
      ''
    ];
  });
  const counterpointLines = report.sections.counterpoints.map((item, index) => `${index + 1}. ${item}`);
  const actionLines = report.sections.actionItems.flatMap((item) => [
    `### ${item.title}`,
    '',
    ...item.paragraphs,
    ''
  ]);
  const readNextLines = report.sections.readNext.map((item, index) => `${index + 1}. ${item.label}：${item.url}`);

  return [
    `# ${report.title}`,
    '',
    report.intro,
    '',
    '## 今日结论',
    ...verdictLines,
    '',
    '## 核心论证',
    ...argumentLines,
    '## 反论点与不确定性',
    ...counterpointLines,
    '',
    '## 创始人行动建议',
    ...actionLines,
    '## 延伸阅读',
    ...readNextLines,
    ''
  ].join('\n');
}
