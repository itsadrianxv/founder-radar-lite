import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('deploy-main script parses as valid PowerShell', async () => {
  const result = await runPowerShell(
    "[ScriptBlock]::Create((Get-Content -Raw 'deploy/deploy-main.ps1')) | Out-Null"
  );

  assert.equal(result.code, 0, result.stderr);
});

function runPowerShell(command) {
  return new Promise((resolve) => {
    const child = spawn('powershell', ['-NoProfile', '-Command', command], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}
