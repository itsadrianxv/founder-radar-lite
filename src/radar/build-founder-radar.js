const SOURCE_PRIORITY = {
  x: 3,
  blog: 2,
  podcast: 1
};

const CANDIDATE_BASE_WEIGHT = {
  x: 8,
  blog: 8,
  podcast: 7
};

const MAX_SIGNAL_AGE_HOURS = {
  x: 24,
  blog: 24,
  podcast: 24
};

const THEME_RULES = [
  { tag: 'agents', keywords: ['agent', 'agents', 'tool', 'workflow', 'automation', 'coding'] },
  { tag: 'research', keywords: ['proof', 'research', 'science', 'model', 'open problems'] },
  { tag: 'teams', keywords: ['team', 'teams', 'founder', 'startup', 'yc', 'company'] },
  { tag: 'distribution', keywords: ['growth', 'launch', 'ship', 'shipping', 'product'] }
];

const NARRATIVE_THEME_ORDER = ['agents', 'research', 'distribution', 'teams'];

const NARRATIVE_THEME_CONFIG = {
  agents: {
    cuePhrases: ['review', 'handoff', 'tooling', 'orchestration', 'workflow', 'approval', 'rollback', 'audit', 'automation', 'deployment', 'deploy'],
    fallbackFocus: 'review、handoff、workflow orchestration',
    verdictLead: '今天更扎实的 agent 信号，不在泛泛而谈“更聪明”，而在',
    implication: '产品门槛已经从模型演示转向链路审阅、交付稳定性与可回滚性。',
    argumentHeadline: '这些 workflow 节点正在成为 agent 产品的真实门槛',
    actionTitle: '把这段 agent 链路拆成可审阅的默认动作'
  },
  research: {
    cuePhrases: ['proof', 'proofs', 'benchmark', 'benchmarks', 'evaluation', 'eval', 'open problems', 'science', 'reasoning', 'research'],
    fallbackFocus: 'proof、benchmark、evaluation',
    verdictLead: '今天真正抬高产品预期的研究信号，集中在',
    implication: '研究进展已经开始重写产品团队的验证门槛与用户预期。',
    argumentHeadline: '研究进展正在直接传导到产品验证标准',
    actionTitle: '把研究验证要求前置进发布流程'
  },
  distribution: {
    cuePhrases: ['launch', 'distribution', 'growth', 'pricing', 'positioning', 'packaging', 'gtm', 'go-to-market', 'ship', 'shipping'],
    fallbackFocus: 'launch、distribution、pricing',
    verdictLead: '今天真正拉开差距的分发信号，落在',
    implication: '竞争开始从“谁有模型”切到“谁更会 launch、package 与持续转化”。',
    argumentHeadline: 'go-to-market 动作开始决定 AI 产品的复利速度',
    actionTitle: '围绕分发动作重写 launch 与 packaging'
  },
  teams: {
    cuePhrases: ['team', 'teams', 'founder', 'founders', 'startup', 'headcount', 'hiring', 'lean team', 'small team'],
    fallbackFocus: 'team design、headcount、founder loops',
    verdictLead: '今天的小团队高杠杆，不再是一句空泛口号，而是',
    implication: '高杠杆正在从抽象效率叙事，落到具体组织分工、审阅边界与人员配置。',
    argumentHeadline: '小团队高杠杆开始表现为具体组织动作',
    actionTitle: '把高杠杆组织动作固化成团队默认规则'
  }
};

const DISTINCTIVE_WORD_STOPLIST = new Set([
  'about', 'after', 'agent', 'agents', 'around', 'because', 'being', 'better', 'build', 'builder', 'builders',
  'changes', 'coding', 'company', 'continue', 'delivery', 'fewer', 'finally', 'founder', 'founders', 'growth',
  'human', 'launch', 'model', 'models', 'people', 'product', 'products', 'proof', 'proofs', 'research',
  'shipping', 'signal', 'signals', 'small', 'startup', 'teams', 'their', 'these', 'through', 'today', 'tool',
  'tools', 'workflow', 'workflows'
]);

export function buildFounderRadar(input, options = {}) {
  const normalizedOptions = {
    language: options.language || 'zh-CN',
    style: options.style || 'verdict+evidence',
    delivery: options.delivery || 'lark_dm',
    pruning: normalizePruningOptions(options.pruning)
  };

  const candidates = collectCandidates(input);
  const recentCandidates = filterRecentCandidates(candidates, input.generatedAt);
  const scoredSignals = applyPruningFilters(recentCandidates, normalizedOptions.pruning)
    .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate) }))
    .sort(compareSignals);
  const limitedSignals = applyPerTypeCandidateMax(scoredSignals, normalizedOptions.pruning.max)
    .sort(compareSignals);

  const topSignals = limitedSignals.slice(0, 5);
  const whoToWatch = buildWhoToWatch(limitedSignals);
  const opportunities = buildOpportunitySeeds(topSignals, whoToWatch);
  const verdictEntries = buildNarrativeVerdictEntries(topSignals);
  const verdicts = verdictEntries.map((entry) => entry.text);
  const readNext = buildReadNext(topSignals, limitedSignals);
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
      verdictEntries,
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
  const verdictEntries = brief.sections.verdictEntries || buildNarrativeVerdictEntries(topSignals);
  const report = {
    title: `Founder Radar 深度日报｜${dateLabel}`,
    intro: `这份深度日报继续以 follow-builders 为核心信号输入，只保留本仓库定义的高信号构建者与内容源。今天进入视野的重点，不是单条新闻本身，而是这些信号共同描出的组织、工作流与分发变化：构建者已经开始把模型能力从“能展示”推进到“能交付、能审核、能复盘”。`,
    sections: {
      todayVerdict: verdictEntries.map((entry, index) => expandNarrativeVerdict(entry, topSignals, opportunities[index])),
      coreArguments: buildNarrativeCoreArguments(verdictEntries, topSignals),
      counterpoints: buildCounterpoints(topSignals),
      actionItems: buildNarrativeActionItems(verdictEntries, topSignals, opportunities, whoToWatch),
      readNext: buildReadNextLinks(topSignals, brief.sections.readNext)
    }
  };

  return {
    ...report,
    brief,
    markdown: renderDeepDigestMarkdown(report)
  };
}

function normalizePruningOptions(pruning = {}) {
  return {
    x: {
      includeHandles: normalizeHandleList(pruning.x?.includeHandles),
      excludeHandles: normalizeHandleList(pruning.x?.excludeHandles)
    },
    blog: {
      includeSources: normalizeStringList(pruning.blog?.includeSources),
      excludeSources: normalizeStringList(pruning.blog?.excludeSources)
    },
    podcast: {
      includeSources: normalizeStringList(pruning.podcast?.includeSources),
      excludeSources: normalizeStringList(pruning.podcast?.excludeSources)
    },
    max: {
      xCandidates: normalizeMaxCount(pruning.max?.xCandidates),
      blogCandidates: normalizeMaxCount(pruning.max?.blogCandidates),
      podcastCandidates: normalizeMaxCount(pruning.max?.podcastCandidates)
    }
  };
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function normalizeHandleList(values) {
  return normalizeStringList(values).map((value) => value.toLowerCase());
}

function normalizeMaxCount(value) {
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

function applyPruningFilters(candidates, pruning) {
  return candidates.filter((candidate) => shouldKeepCandidate(candidate, pruning));
}

function shouldKeepCandidate(candidate, pruning) {
  if (candidate.type === 'x') {
    const handle = String(candidate.handle || '').toLowerCase();
    const excluded = pruning.x.excludeHandles.includes(handle);
    if (excluded) return false;
    if (pruning.x.includeHandles.length === 0) return true;
    return pruning.x.includeHandles.includes(handle);
  }

  if (candidate.type === 'blog') {
    const sourceName = String(candidate.sourceName || '').trim();
    const excluded = pruning.blog.excludeSources.includes(sourceName);
    if (excluded) return false;
    if (pruning.blog.includeSources.length === 0) return true;
    return pruning.blog.includeSources.includes(sourceName);
  }

  if (candidate.type === 'podcast') {
    const sourceName = String(candidate.sourceName || '').trim();
    const excluded = pruning.podcast.excludeSources.includes(sourceName);
    if (excluded) return false;
    if (pruning.podcast.includeSources.length === 0) return true;
    return pruning.podcast.includeSources.includes(sourceName);
  }

  return true;
}

function applyPerTypeCandidateMax(scoredSignals, maxByType) {
  const xSignals = scoredSignals.filter((signal) => signal.type === 'x');
  const blogSignals = scoredSignals.filter((signal) => signal.type === 'blog');
  const podcastSignals = scoredSignals.filter((signal) => signal.type === 'podcast');

  const limitedXSignals = maxByType.xCandidates ? xSignals.slice(0, maxByType.xCandidates) : xSignals;
  const limitedBlogSignals = maxByType.blogCandidates ? blogSignals.slice(0, maxByType.blogCandidates) : blogSignals;
  const limitedPodcastSignals = maxByType.podcastCandidates ? podcastSignals.slice(0, maxByType.podcastCandidates) : podcastSignals;

  return [...limitedXSignals, ...limitedBlogSignals, ...limitedPodcastSignals];
}

function filterRecentCandidates(candidates, generatedAt) {
  return candidates.filter((candidate) => isCandidateWithinRecencyWindow(candidate, generatedAt));
}

function isCandidateWithinRecencyWindow(candidate, generatedAt) {
  const maxAgeHours = MAX_SIGNAL_AGE_HOURS[candidate.type];
  if (!maxAgeHours) return true;

  const publishedAt = Date.parse(candidate.publishedAt);
  const referenceTime = Date.parse(generatedAt || Date.now());
  if (!Number.isFinite(publishedAt) || !Number.isFinite(referenceTime)) {
    return true;
  }

  const ageMs = referenceTime - publishedAt;
  if (ageMs < 0) return true;

  return ageMs <= maxAgeHours * 60 * 60 * 1000;
}

function collectCandidates(input) {
  const groupedAccounts = new Map();
  for (const account of input.x || []) {
    const normalizedHandle = String(account.handle || '').trim().toLowerCase();
    const sourceName = String(account.name || normalizedHandle || 'Unknown X Source').trim();
    const accountKey = normalizedHandle || sourceName;
    const current = groupedAccounts.get(accountKey) || {
      sourceName,
      handle: normalizedHandle || null,
      tweets: []
    };
    current.tweets.push(...(account.tweets || []));
    groupedAccounts.set(accountKey, current);
  }

  const xCandidates = [...groupedAccounts.values()].map((account) => {
    const rankedTweets = [...account.tweets].sort((left, right) => {
      const leftScore = (left.likes || 0) + (left.retweets || 0) * 2 + (left.replies || 0);
      const rightScore = (right.likes || 0) + (right.retweets || 0) * 2 + (right.replies || 0);
      return rightScore - leftScore || String(right.createdAt).localeCompare(String(left.createdAt));
    });
    const leadTweet = rankedTweets[0];
    if (!leadTweet) return null;
    const combinedText = rankedTweets.map((tweet) => String(tweet.text || '')).join(' ').trim();

    return {
      type: 'x',
      sourceName: account.sourceName,
      handle: account.handle,
      title: `${account.sourceName} 在 X 上的更新`,
      summary: summarizeText(leadTweet.text, 180),
      evidence: summarizeText(combinedText, 140),
      url: leadTweet.url,
      publishedAt: leadTweet.createdAt,
      weight: CANDIDATE_BASE_WEIGHT.x,
      themeTags: inferThemeTags(combinedText),
      engagement: rankedTweets.reduce(
        (sum, tweet) => sum + (tweet.likes || 0) + (tweet.retweets || 0) * 2 + (tweet.replies || 0),
        0
      ),
      rawText: combinedText
    };
  }).filter(Boolean);

  const blogCandidates = (input.blogs || [])
    .map((blog) => {
      const sourceName = String(blog.name || 'Unknown Blog').trim();
      const text = `${blog.title} ${blog.description || ''} ${blog.content || ''}`.trim();
      return {
        type: 'blog',
        sourceName,
        handle: null,
        title: blog.title,
        summary: summarizeText(text, 180),
        evidence: summarizeText(blog.content || blog.description || blog.title, 140),
        url: blog.url,
        publishedAt: blog.publishedAt,
        weight: CANDIDATE_BASE_WEIGHT.blog,
        themeTags: inferThemeTags(text),
        engagement: 40,
        rawText: text
      };
    });

  const podcastCandidates = (input.podcasts || [])
    .map((podcast) => {
      const sourceName = String(podcast.name || 'Unknown Podcast').trim();
      const text = `${podcast.title} ${podcast.transcript || ''}`.trim();
      return {
        type: 'podcast',
        sourceName,
        handle: null,
        title: podcast.title,
        summary: summarizeText(text, 180),
        evidence: summarizeText(podcast.transcript || podcast.title, 140),
        url: podcast.url,
        publishedAt: podcast.publishedAt,
        weight: CANDIDATE_BASE_WEIGHT.podcast,
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

function buildVerdictEntries(topSignals) {
  const themeCounts = countThemes(topSignals);
  const sortedThemes = Object.entries(themeCounts).sort((left, right) => right[1] - left[1]);
  const verdictEntries = [];

  if (themeCounts.agents) {
    verdictEntries.push({
      tag: 'agents',
      text: 'Agent 工作流仍是今天最强的产品叙事，讨论重心集中在工具编排、自动化交付与效率放大。'
    });
  }
  if (themeCounts.research) {
    verdictEntries.push({
      tag: 'research',
      text: '前沿模型能力仍在向“更强问题求解 + 更优雅证明”延伸，研究进展正在反向抬升产品预期。'
    });
  }
  if (themeCounts.teams || themeCounts.distribution) {
    verdictEntries.push({
      tag: themeCounts.teams >= themeCounts.distribution ? 'teams' : 'distribution',
      text: '小团队高杠杆创业继续强化：创始人和产品负责人都在默认接受“更少人做更多事”。'
    });
  }

  while (verdictEntries.length < 3) {
    const tag = sortedThemes[verdictEntries.length]?.[0];
    verdictEntries.push({
      tag,
      text: fallbackVerdict(tag)
    });
  }

  return verdictEntries.slice(0, 3);
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

function buildNarrativeVerdictEntries(topSignals) {
  const selectedCandidates = NARRATIVE_THEME_ORDER
    .map((tag) => buildThemeNarrativeCandidate(topSignals, tag))
    .filter((candidate) => candidate.score > 0)
    .slice(0, 3);

  const verdictEntries = selectedCandidates
    .map((candidate) => createNarrativeVerdictEntry(candidate.tag, candidate.supportingSignals, candidate.cuePhrases));

  let fallbackIndex = 0;
  while (verdictEntries.length < 3 && fallbackIndex < topSignals.length) {
    const fallbackCandidate = buildSignalNarrativeCandidate(topSignals[fallbackIndex]);
    fallbackIndex += 1;
    verdictEntries.push(
      createNarrativeVerdictEntry(
        fallbackCandidate.tag,
        fallbackCandidate.supportingSignals,
        fallbackCandidate.cuePhrases
      )
    );
  }

  while (verdictEntries.length < 3) {
    verdictEntries.push(createNarrativeVerdictEntry('distribution', topSignals.slice(0, 2), []));
  }

  return verdictEntries.slice(0, 3);
}

function buildThemeNarrativeCandidate(topSignals, tag) {
  const supportingSignals = topSignals
    .map((signal, index) => {
      const cuePhrases = findNarrativeCueHits(signal, tag);
      const themeMatch = signal.themeTags.includes(tag);
      if (cuePhrases.length === 0 && !themeMatch) {
        return null;
      }

      return {
        signal,
        cuePhrases,
        index,
        weight: cuePhrases.length * 12 + (themeMatch ? 4 : 0) + ((signal.score || 0) / 10)
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.weight - left.weight || left.index - right.index);

  return {
    tag,
    score: supportingSignals.reduce((sum, item) => sum + item.weight, 0),
    supportingSignals: supportingSignals.slice(0, 2).map((item) => item.signal),
    cuePhrases: uniqueStable(supportingSignals.flatMap((item) => item.cuePhrases)).slice(0, 3)
  };
}

function compareNarrativeCandidates(left, right) {
  return (
    right.score - left.score ||
    right.supportingSignals.length - left.supportingSignals.length ||
    NARRATIVE_THEME_ORDER.indexOf(left.tag) - NARRATIVE_THEME_ORDER.indexOf(right.tag)
  );
}

function buildSignalNarrativeCandidate(signal) {
  const tag = pickNarrativeThemeForSignal(signal);
  return {
    tag,
    supportingSignals: [signal],
    cuePhrases: findNarrativeCueHits(signal, tag).slice(0, 3)
  };
}

function createNarrativeVerdictEntry(tag, supportingSignals, cuePhrases) {
  const normalizedSignals = supportingSignals.length > 0 ? supportingSignals : [];
  const focus = buildNarrativeFocus(tag, cuePhrases, normalizedSignals);
  return {
    tag,
    text: buildNarrativeText(tag, focus),
    focus,
    cuePhrases: cuePhrases.length > 0 ? cuePhrases : extractDistinctiveTerms(normalizedSignals, tag).slice(0, 3),
    supportingSignalUrls: normalizedSignals.map((signal) => signal.url)
  };
}

function buildNarrativeText(tag, focus) {
  const config = NARRATIVE_THEME_CONFIG[tag] || NARRATIVE_THEME_CONFIG.distribution;
  return `${config.verdictLead} ${focus} 这些动作。${config.implication}`;
}

function buildNarrativeFocus(tag, cuePhrases, supportingSignals) {
  if (cuePhrases.length > 0) {
    return cuePhrases.slice(0, 3).join('、');
  }

  const distinctiveTerms = extractDistinctiveTerms(supportingSignals, tag);
  if (distinctiveTerms.length > 0) {
    return distinctiveTerms.slice(0, 3).join('、');
  }

  return (NARRATIVE_THEME_CONFIG[tag] || NARRATIVE_THEME_CONFIG.distribution).fallbackFocus;
}

function buildNarrativeSearchText(signal) {
  return [
    signal.title,
    signal.summary,
    signal.evidence,
    signal.rawText
  ]
    .join(' ')
    .toLowerCase();
}

function findNarrativeCueHits(signal, tag) {
  const searchText = buildNarrativeSearchText(signal);
  const cuePhrases = (NARRATIVE_THEME_CONFIG[tag] || NARRATIVE_THEME_CONFIG.distribution).cuePhrases;
  return cuePhrases.filter((cuePhrase) => searchText.includes(cuePhrase.toLowerCase()));
}

function extractDistinctiveTerms(signals, tag) {
  const cuePhraseSet = new Set((NARRATIVE_THEME_CONFIG[tag] || NARRATIVE_THEME_CONFIG.distribution).cuePhrases);
  const distinctiveTerms = [];

  for (const signal of signals) {
    const words = buildNarrativeSearchText(signal)
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 4);

    for (const word of words) {
      if (DISTINCTIVE_WORD_STOPLIST.has(word) || cuePhraseSet.has(word)) continue;
      distinctiveTerms.push(word);
    }
  }

  return uniqueStable(distinctiveTerms);
}

function uniqueStable(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(String(value || '').trim());
  }
  return output;
}

function pickNarrativeThemeForSignal(signal) {
  const rankedTags = NARRATIVE_THEME_ORDER
    .map((tag) => ({
      tag,
      score: findNarrativeCueHits(signal, tag).length * 10 + (signal.themeTags.includes(tag) ? 1 : 0)
    }))
    .sort((left, right) => right.score - left.score || NARRATIVE_THEME_ORDER.indexOf(left.tag) - NARRATIVE_THEME_ORDER.indexOf(right.tag));

  return rankedTags[0]?.score > 0 ? rankedTags[0].tag : signal.themeTags[0] || 'distribution';
}

function resolveNarrativeSignals(entry, topSignals) {
  const supportingSignals = (entry.supportingSignalUrls || [])
    .map((url) => topSignals.find((signal) => signal.url === url))
    .filter(Boolean);

  if (supportingSignals.length > 0) {
    return supportingSignals;
  }

  return pickSignalsForVerdict(topSignals, entry.tag);
}

function buildNarrativeArgumentHeadline(entry, index) {
  const prefix = ['一', '二', '三'][index] || String(index + 1);
  const config = NARRATIVE_THEME_CONFIG[entry.tag] || NARRATIVE_THEME_CONFIG.distribution;
  return `论证${prefix}：${entry.focus} 背后的含义是 ${config.argumentHeadline}`;
}

function buildNarrativeThemeImplication(tag) {
  switch (tag) {
    case 'agents':
      return '这意味着下一步更值得做的，不是再堆一个更通用的入口，而是把关键审核节点和交付回路单独产品化。';
    case 'research':
      return '这意味着产品团队不能只复述模型进展，而要把 proof、benchmark 和 evaluation 真的接进发布判断。';
    case 'distribution':
      return '这意味着真正的优势会越来越多地来自 launch 节奏、pricing 设计和 package 方式，而不是同质化功能表。';
    case 'teams':
      return '这意味着小团队优势不会自动出现，只有把审阅边界、职责切分和 headcount 纪律做细，杠杆才会成立。';
    default:
      return '这意味着判断标准要回到真实工作流、真实分发路径和真实组织约束。';
  }
}

function buildNarrativeCoreArguments(verdictEntries, topSignals) {
  return verdictEntries.map((entry, index) => {
    const supportingSignals = resolveNarrativeSignals(entry, topSignals);
    const actorLabels = supportingSignals.map((signal) => buildActorLabel(signal));
    const citations = supportingSignals.map((signal) => ({
      label: buildActorLabel(signal),
      url: signal.url
    }));

    return {
      title: buildNarrativeArgumentHeadline(entry, index),
      paragraphs: [
        `从 ${actorLabels.join('、') || '今天最强的几条信号'} 来看，最该被单独拿出来判断的，不是抽象的 AI 能力，而是 ${entry.focus} 这组具体动作已经被反复提及。它们共同说明，今天的高信号在把“能做”压成“能稳定交付、能被团队接手、能被市场验证”。`,
        buildNarrativeThemeImplication(entry.tag)
      ],
      citations
    };
  });
}

function expandNarrativeVerdict(entry, topSignals, opportunity) {
  const supportingSignals = resolveNarrativeSignals(entry, topSignals);
  const actorLabels = supportingSignals.map((signal) => buildActorLabel(signal));
  const evidenceSummary = supportingSignals
    .map((signal) => `${buildActorLabel(signal)} 提到的 ${buildNarrativeFocus(entry.tag, findNarrativeCueHits(signal, entry.tag), [signal])}`)
    .join('、');
  const opportunityHeadline = opportunity?.headline
    ? `如果要先做一个动作，优先从“${opportunity.headline}”这类贴近 ${entry.focus} 的环节下手。`
    : `如果要先做一个动作，就先把 ${entry.focus} 这段链路拆成一个可复盘、可审阅的默认动作。`;

  return `${entry.text} 今天把这个判断撑起来的，是 ${actorLabels.join('、') || '几条最强信号'} 在 ${evidenceSummary || entry.focus} 上给出的连续证据。${opportunityHeadline}`;
}

function buildNarrativeActionTitle(entry, index) {
  const prefix = ['一', '二', '三'][index] || String(index + 1);
  const config = NARRATIVE_THEME_CONFIG[entry.tag] || NARRATIVE_THEME_CONFIG.distribution;
  return `动作${prefix}：${config.actionTitle}`;
}

function buildNarrativeActionParagraph(entry, supportingSignals, opportunity, whoToWatch) {
  const actorLabels = supportingSignals.map((signal) => buildActorLabel(signal));
  const watchNames = whoToWatch.map((item) => item.name).join('、');
  const firstSentence = `先围绕 ${entry.focus} 这组动作重新拆工作流，并把 ${actorLabels.join('、') || '今天最强的几条信号'} 当成你要追踪的真实样板。`;
  const secondSentence = opportunity?.headline
    ? `它最接近的落点不是抽象战略，而是 ${opportunity.headline} 这种能被团队直接执行的交付动作。`
    : `重点不是多写一层包装文案，而是让这段链路能被团队稳定重复、稳定审阅。`;
  const thirdSentence = watchNames
    ? `接下来持续观察 ${watchNames}，但只记录他们如何把这组信号落实成具体流程。`
    : '';

  return [firstSentence, secondSentence, thirdSentence].filter(Boolean).join(' ');
}

function buildNarrativeActionItems(verdictEntries, topSignals, opportunities, whoToWatch) {
  return verdictEntries.map((entry, index) => {
    return {
      title: buildNarrativeActionTitle(entry, index),
      paragraphs: [
        buildNarrativeActionParagraph(entry, resolveNarrativeSignals(entry, topSignals), opportunities[index], whoToWatch)
      ]
    };
  });
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

function expandVerdict(entry, topSignals, opportunity) {
  const verdict = entry.text;
  const referencedActors = pickSignalsForVerdict(topSignals, entry.tag)
    .map((signal) => buildActorLabel(signal))
    .join('、');
  const opportunityLine = opportunity
    ? `从行动层面看，最值得先试的方向是“${opportunity.headline}”，因为它最接近今天这组信号真正指向的交付瓶颈。`
    : '从行动层面看，最重要的不是继续收集观点，而是找出你团队里最值得被产品化的一条关键链路。';

  return `${verdict} 更具体地说，今天最强的证据不是孤立出现的，而是由 ${referencedActors || '多位核心信号源'} 一起拼出来的同一幅图景：大家都在把 AI 能力往真实工作流、团队杠杆和产品交付上压。${opportunityLine}`;
}

function pickSignalsForVerdict(topSignals, tag) {
  const relatedTags = relatedVerdictTags(tag);
  const matchingSignals = topSignals.filter((signal) => signal.themeTags.some((theme) => relatedTags.includes(theme)));

  if (matchingSignals.length >= 2) {
    return matchingSignals.slice(0, 2);
  }

  const fallbackSignals = [...matchingSignals];
  for (const signal of topSignals) {
    if (fallbackSignals.length >= 2) break;
    if (fallbackSignals.some((item) => item.url === signal.url)) continue;
    fallbackSignals.push(signal);
  }

  return fallbackSignals.slice(0, 2);
}

function relatedVerdictTags(tag) {
  switch (tag) {
    case 'teams':
      return ['teams', 'distribution'];
    case 'distribution':
      return ['distribution', 'teams'];
    case 'research':
      return ['research'];
    case 'agents':
    default:
      return ['agents'];
  }
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
