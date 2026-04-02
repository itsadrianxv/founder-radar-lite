import { readFile } from 'node:fs/promises';

import { createLarkClient } from './lark/client.js';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const text = args.file
    ? await readFile(args.file, 'utf-8')
    : await readStdin();

  const client = createLarkClient({
    appId: process.env.LARK_APP_ID,
    appSecret: process.env.LARK_APP_SECRET,
    baseUrl: process.env.LARK_BASE_URL
  });

  const result = await client.sendText({
    receiveId: args.to || process.env.LARK_RECIPIENT_OPEN_ID,
    text
  });

  process.stdout.write(`sent ${result.sent} message(s) to ${args.to || process.env.LARK_RECIPIENT_OPEN_ID}\n`);
}

function parseArgs(args) {
  const parsed = {
    to: '',
    file: ''
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--to') {
      parsed.to = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--file') {
      parsed.file = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--stdin') {
      continue;
    }
    throw new Error(`Unsupported argument: ${arg}`);
  }

  if (!parsed.to && !process.env.LARK_RECIPIENT_OPEN_ID) {
    throw new Error('Lark target open_id is required via --to or LARK_RECIPIENT_OPEN_ID');
  }

  if (!parsed.file && process.stdin.isTTY) {
    throw new Error('Provide --file or pipe message text via stdin');
  }

  return parsed;
}

function readStdin() {
  return new Promise((resolve) => {
    let body = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => {
      body += chunk;
    });
    process.stdin.on('end', () => resolve(body));
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
