import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';

test('deploy-main script parses as valid PowerShell', async (t) => {
  const shell = resolvePowerShellExecutable();
  if (!shell) {
    t.skip('PowerShell is not installed on this platform');
  }

  const result = await runPowerShell(
    shell,
    "[ScriptBlock]::Create((Get-Content -Raw 'deploy/deploy-main.ps1')) | Out-Null"
  );

  assert.equal(result.code, 0, result.stderr);
});

function resolvePowerShellExecutable() {
  for (const candidate of ['pwsh', 'powershell']) {
    const result = spawnSync(candidate, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], {
      stdio: 'ignore'
    });

    if (!result.error && result.status === 0) {
      return candidate;
    }
  }

  return null;
}

function runPowerShell(shell, command) {
  return new Promise((resolve) => {
    const child = spawn(shell, ['-NoProfile', '-Command', command], {
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
