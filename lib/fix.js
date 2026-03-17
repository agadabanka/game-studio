/**
 * game-studio fix — Auto-fix open GitHub issues via Game Factory.
 *
 * Fetches open issues from the game's GitHub repo, sends them to
 * Game Factory's fix-issues endpoint, and applies fixes to game.js.
 *
 * Usage:
 *   game-studio fix                   # Analyze issues (dry run)
 *   game-studio fix --apply           # Analyze + apply fixes
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export default async function fix({ args, cwd, config, factoryUrl }) {
  const apply = args.includes('--apply');
  const projectId = args.find((_, i) => args[i - 1] === '--project') || config.projectId;

  if (!projectId) {
    throw new Error(
      'No project ID configured. Either:\n' +
      '  - Add "projectId" to game-studio.json\n' +
      '  - Run: game-studio fix --project <id>'
    );
  }

  console.log(`Fetching open issues for project ${projectId}...`);

  const url = `${factoryUrl}/api/projects/${projectId}/fix-issues${apply ? '?apply=true' : ''}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Fix issues failed (${resp.status}): ${err}`);
  }

  const result = await resp.json();

  if (!result.fixes || result.fixes.length === 0) {
    console.log('No open issues to fix.');
    return;
  }

  console.log(`\n── Fix Results ──────────────────────────────`);
  for (const fix of result.fixes) {
    const status = fix.fixable ? (apply ? 'FIXED' : 'FIXABLE') : 'COMPILER LIMITATION';
    console.log(`  #${fix.issue_number}: [${status}] ${fix.description}`);
  }

  if (apply) {
    console.log(`\n  Applied: ${result.applied || 0}`);
    console.log(`  Skipped: ${result.skipped || 0}`);
    console.log('\n  Run "game-studio pull-sdk && game-studio build" to rebuild.');
  } else {
    console.log('\n  Dry run complete. Add --apply to commit fixes.');
  }
}
