import { renderDeepDigestMarkdown } from '../radar/build-founder-radar.js';

const DEFAULT_LLM_BASE_URL = 'https://api.deepseek.com/v1';
const DEFAULT_LLM_MODEL = 'deepseek-reasoner';

export function createOpenAiCompatibleClient({
  baseUrl = process.env.FOUNDER_RADAR_LLM_BASE_URL || DEFAULT_LLM_BASE_URL,
  apiKey = process.env.FOUNDER_RADAR_LLM_API_KEY,
  model = process.env.FOUNDER_RADAR_LLM_MODEL || DEFAULT_LLM_MODEL,
  fetchImpl = fetch
} = {}) {
  async function enrichDigestReport(fallbackReport) {
    if (!apiKey) {
      return fallbackReport;
    }

    const endpoint = `${String(baseUrl).replace(/\/$/, '')}/chat/completions`;
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        messages: [
          {
            role: 'system',
            content: '你是 Founder Radar 的中文总编。你只能输出一个 JSON 对象，不要输出 Markdown 代码块，不要编造事实。'
          },
          {
            role: 'user',
            content: buildSignalDigestPrompt(fallbackReport)
          }
        ]
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`LLM request failed: HTTP ${response.status}`);
    }

    const rawContent = payload.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error('LLM response missing message content');
    }

    const parsed = JSON.parse(extractJsonObject(rawContent));
    return mergeDigestReport(fallbackReport, parsed);
  }

  return {
    enrichDigestReport
  };
}

function buildDigestPrompt(fallbackReport) {
  return [
    '请根据下面的 Founder Radar 草稿，输出更有判断力的 20 分钟中文深度日报。',
    '要求：',
    '1. 只用中文写作，专有名词和链接除外。',
    '2. 必须输出一个 JSON 对象，字段为 title、intro、sections。',
    '3. sections 里必须有 todayVerdict、coreArguments、counterpoints、actionItems、readNext。',
    '4. todayVerdict 是字符串数组；coreArguments 是对象数组，每项包含 title、paragraphs、citations；counterpoints 是字符串数组；actionItems 是对象数组，每项包含 title、paragraphs；readNext 是对象数组，每项包含 label、url。',
    '5. 不要删掉已有来源链接，不要新增草稿里没有的事实。',
    '',
    '草稿标题：',
    fallbackReport.title,
    '',
    '草稿引言：',
    fallbackReport.intro,
    '',
    '草稿正文：',
    fallbackReport.markdown
  ].join('\n');
}

function buildSignalDigestPrompt(fallbackReport) {
  const topSignals = fallbackReport.brief?.sections?.topSignals || [];
  const readNext = fallbackReport.sections?.readNext || [];

  return [
    '请根据下面的 raw daily signals，输出一份更有判断力的 20 分钟 Founder Radar 中文深度日报。',
    '要求：',
    '1. 只用中文写作，专有名词、英文 cue、链接除外。',
    '2. 必须输出一个 JSON 对象，字段为 title、intro、sections。',
    '3. sections 里必须有 todayVerdict、coreArguments、counterpoints、actionItems、readNext。',
    '4. todayVerdict 必须有 3 条 materially different 的 signal-explicit 结论；不要复用固定三句模板，也不要把不同 source 压成同一套判断。',
    '5. coreArguments、actionItems 要直接回应当天最强的 signals，而不是复述模板化叙事。',
    '6. 不要删掉已有来源链接，不要新增 signal cards 里没有的事实。',
    '',
    'Report title seed:',
    fallbackReport.title,
    '',
    'Report intro seed:',
    fallbackReport.intro,
    '',
    'Top signal cards:',
    formatTopSignalCards(topSignals),
    '',
    'Link inventory:',
    formatLinkInventory(readNext)
  ].join('\n');
}

function formatTopSignalCards(topSignals) {
  if (!Array.isArray(topSignals) || topSignals.length === 0) {
    return 'No top signals available.';
  }

  return topSignals.map((signal, index) => [
    `${index + 1}. ${formatSignalActor(signal)}`,
    `type: ${signal.type}`,
    `summary: ${signal.summary}`,
    `evidence: ${signal.evidence}`,
    `themes: ${(signal.themeTags || []).join(', ')}`,
    `url: ${signal.url}`
  ].join('\n')).join('\n\n');
}

function formatLinkInventory(readNext) {
  if (!Array.isArray(readNext) || readNext.length === 0) {
    return 'No links.';
  }

  return readNext
    .map((item, index) => {
      if (typeof item === 'string') {
        return `${index + 1}. ${item}`;
      }
      return `${index + 1}. ${item.label}: ${item.url}`;
    })
    .join('\n');
}

function formatSignalActor(signal) {
  return signal.handle ? `${signal.sourceName} (@${signal.handle})` : signal.sourceName;
}

function extractJsonObject(content) {
  const trimmed = String(content).trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('LLM response did not contain a JSON object');
  }
  return trimmed.slice(start, end + 1);
}

function mergeDigestReport(fallbackReport, payload) {
  const merged = {
    title: String(payload.title || fallbackReport.title),
    intro: String(payload.intro || fallbackReport.intro),
    sections: {
      todayVerdict: normalizeStringArray(payload.sections?.todayVerdict, fallbackReport.sections.todayVerdict),
      coreArguments: normalizeCoreArguments(payload.sections?.coreArguments, fallbackReport.sections.coreArguments),
      counterpoints: normalizeStringArray(payload.sections?.counterpoints, fallbackReport.sections.counterpoints),
      actionItems: normalizeActionItems(payload.sections?.actionItems, fallbackReport.sections.actionItems),
      readNext: normalizeReadNext(payload.sections?.readNext, fallbackReport.sections.readNext)
    }
  };

  return {
    ...fallbackReport,
    ...merged,
    markdown: renderDeepDigestMarkdown(merged)
  };
}

function normalizeStringArray(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : fallback;
}

function normalizeCoreArguments(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((item, index) => ({
      title: String(item?.title || fallback[index]?.title || '').trim(),
      paragraphs: normalizeStringArray(item?.paragraphs, fallback[index]?.paragraphs || []),
      citations: normalizeReadNext(item?.citations, fallback[index]?.citations || [])
    }))
    .filter((item) => item.title && item.paragraphs.length > 0);

  return normalized.length > 0 ? normalized : fallback;
}

function normalizeActionItems(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((item, index) => ({
      title: String(item?.title || fallback[index]?.title || '').trim(),
      paragraphs: normalizeStringArray(item?.paragraphs, fallback[index]?.paragraphs || [])
    }))
    .filter((item) => item.title && item.paragraphs.length > 0);

  return normalized.length > 0 ? normalized : fallback;
}

function normalizeReadNext(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((item, index) => ({
      label: String(item?.label || fallback[index]?.label || '').trim(),
      url: String(item?.url || fallback[index]?.url || '').trim()
    }))
    .filter((item) => item.label && item.url);

  return normalized.length > 0 ? normalized : fallback;
}
