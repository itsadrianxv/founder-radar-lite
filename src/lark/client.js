const DEFAULT_LARK_BASE_URL = 'https://open.larksuite.com';
const DEFAULT_MAX_TEXT_LENGTH = 4000;

export function createLarkClient({
  appId,
  appSecret,
  baseUrl = DEFAULT_LARK_BASE_URL,
  maxTextLength = DEFAULT_MAX_TEXT_LENGTH,
  fetchImpl = fetch
}) {
  if (!appId) {
    throw new Error('LARK_APP_ID is required');
  }
  if (!appSecret) {
    throw new Error('LARK_APP_SECRET is required');
  }

  async function getTenantAccessToken() {
    const response = await fetchImpl(`${baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret
      })
    });

    const payload = await response.json();

    if (!response.ok || payload.code !== 0 || !payload.tenant_access_token) {
      throw new Error(`Failed to get Lark tenant access token: ${payload.msg || response.status}`);
    }

    return payload.tenant_access_token;
  }

  async function sendText({ receiveId, text }) {
    if (!receiveId) {
      throw new Error('receiveId is required');
    }
    if (!text?.trim()) {
      throw new Error('text is required');
    }

    const token = await getTenantAccessToken();
    const chunks = splitLarkText(text, maxTextLength);

    for (const chunk of chunks) {
      await sendMessage(token, {
        receive_id: receiveId,
        msg_type: 'text',
        content: JSON.stringify({ text: chunk })
      });
    }

    return { sent: chunks.length };
  }

  async function sendPosts({ receiveId, messages }) {
    if (!receiveId) {
      throw new Error('receiveId is required');
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('messages are required');
    }

    const token = await getTenantAccessToken();

    for (const message of messages) {
      await sendMessage(token, {
        receive_id: receiveId,
        msg_type: 'post',
        content: JSON.stringify({
          zh_cn: {
            title: message.title,
            content: message.lines
          }
        })
      });
    }

    return { sent: messages.length };
  }

  async function sendMessage(token, body) {
    const response = await fetchImpl(`${baseUrl}/open-apis/im/v1/messages?receive_id_type=open_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    const payload = await response.json();
    if (!response.ok || payload.code !== 0) {
      throw new Error(`Failed to send Lark message: ${payload.msg || response.status}`);
    }
  }

  return {
    sendPosts,
    sendText
  };
}

export function renderDigestPostMessages(report) {
  const argumentSplitIndex = Math.min(2, Math.max(1, Math.ceil(report.sections.coreArguments.length / 2)));
  const firstArguments = report.sections.coreArguments.slice(0, argumentSplitIndex);
  const secondArguments = report.sections.coreArguments.slice(argumentSplitIndex);

  return compactMessages([
    {
      title: report.title,
      lines: [
        [textNode(report.intro)],
        [textNode('今日结论')],
        ...report.sections.todayVerdict.map((item, index) => [textNode(`${index + 1}. ${item}`)])
      ]
    },
    {
      title: '核心论证（上）',
      lines: renderArgumentLines(firstArguments)
    },
    {
      title: secondArguments.length > 0 ? '核心论证（下）与反论点' : '反论点与不确定性',
      lines: [
        ...renderArgumentLines(secondArguments),
        [textNode('反论点与不确定性')],
        ...report.sections.counterpoints.map((item, index) => [textNode(`${index + 1}. ${item}`)])
      ]
    },
    {
      title: '创始人行动建议与延伸阅读',
      lines: [
        [textNode('创始人行动建议')],
        ...report.sections.actionItems.flatMap((item) => [
          [textNode(item.title)],
          ...item.paragraphs.map((paragraph) => [textNode(paragraph)])
        ]),
        [textNode('延伸阅读')],
        ...report.sections.readNext.map((item, index) => [
          textNode(`${index + 1}. ${item.label}：`),
          linkNode(item.label, item.url)
        ])
      ]
    }
  ]);
}

export function splitLarkText(text, maxTextLength = DEFAULT_MAX_TEXT_LENGTH) {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return [];
  }
  if (normalized.length <= maxTextLength) {
    return [normalized];
  }

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxTextLength) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = '';
    }

    if (paragraph.length <= maxTextLength) {
      current = paragraph;
      continue;
    }

    for (const lineChunk of splitOversizedParagraph(paragraph, maxTextLength)) {
      chunks.push(lineChunk);
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function renderArgumentLines(argumentsList) {
  return argumentsList.flatMap((argument) => [
    [textNode(argument.title)],
    ...argument.paragraphs.map((paragraph) => [textNode(paragraph)]),
    ...argument.citations.map((citation) => [
      textNode('证据链接：'),
      linkNode(citation.label, citation.url)
    ])
  ]);
}

function compactMessages(messages) {
  return messages
    .map((message) => ({
      title: message.title,
      lines: message.lines.filter((line) => Array.isArray(line) && line.length > 0)
    }))
    .filter((message) => message.lines.length > 0);
}

function textNode(text) {
  return {
    tag: 'text',
    text: String(text || '').trim()
  };
}

function linkNode(label, url) {
  return {
    tag: 'a',
    text: String(label || url).trim(),
    href: String(url || '').trim()
  };
}

function splitOversizedParagraph(paragraph, maxTextLength) {
  const words = paragraph.split(/\s+/);
  const chunks = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxTextLength) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (word.length <= maxTextLength) {
      current = word;
      continue;
    }

    const hardChunks = word.match(new RegExp(`.{1,${maxTextLength}}`, 'g')) || [];
    chunks.push(...hardChunks.slice(0, -1));
    current = hardChunks.at(-1) || '';
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}
