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
      const response = await fetchImpl(`${baseUrl}/open-apis/im/v1/messages?receive_id_type=open_id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          receive_id: receiveId,
          msg_type: 'text',
          content: JSON.stringify({ text: chunk })
        })
      });

      const payload = await response.json();
      if (!response.ok || payload.code !== 0) {
        throw new Error(`Failed to send Lark message: ${payload.msg || response.status}`);
      }
    }

    return { sent: chunks.length };
  }

  return {
    sendText
  };
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
