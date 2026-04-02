import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('openclaw prompt triggers deliver flow instead of raw markdown forwarding', async () => {
  const prompt = await readFile('openclaw/founder-radar-daily.prompt.md', 'utf-8');

  assert.match(prompt, /deliver/i);
  assert.doesNotMatch(prompt, /raw markdown only/i);
});

test('project skill instructs agents to trigger delivery instead of echoing markdown', async () => {
  const skill = await readFile('SKILL.md', 'utf-8');

  assert.match(skill, /deliver/i);
  assert.doesNotMatch(skill, /原样发|exactly as-is|raw markdown/i);
});
