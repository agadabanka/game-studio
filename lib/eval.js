/**
 * game-studio eval — Run AI quality evaluation via Game Factory.
 *
 * Sends the game source to Game Factory's eval endpoint, which:
 *   1. Compiles and analyzes the game spec
 *   2. Uses Claude to score quality (0-100, 80+ is good)
 *   3. Returns bugs found and a fixed version if score < 80
 *   4. Optionally creates GitHub issues for each bug
 *
 * Usage:
 *   game-studio eval                    # Basic eval
 *   game-studio eval --fix              # Eval + auto-apply fixes
 *   game-studio eval --project <id>     # Eval within a project context
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export default async function evalGame({ args, cwd, config, factoryUrl }) {
  const gameFile = join(cwd, 'game.js');
  if (!existsSync(gameFile)) {
    throw new Error('No game.js found.');
  }

  const source = readFileSync(gameFile, 'utf-8');
  const autoFix = args.includes('--fix');
  const useVisionDiff = args.includes('--vision-diff');
  const projectId = args.find((_, i) => args[i - 1] === '--project') || config.projectId;

  // Delegate to vision-diff loop if requested
  if (useVisionDiff) {
    const { default: visionDiffEval } = await import('./vision-diff/index.js');
    return visionDiffEval({ args, cwd, config, factoryUrl });
  }

  console.log('Running AI evaluation...');
  console.log(`  Factory: ${factoryUrl}`);
  console.log(`  Source: ${source.length} bytes`);

  // Try project-scoped eval first, fall back to simple eval
  let evalUrl, body;
  if (projectId) {
    evalUrl = `${factoryUrl}/api/projects/${projectId}/eval`;
    body = {
      spec: { _tsSource: source, _specType: 'ts' },
      sourceCode: source,
      telemetry: { source: 'game-studio-cli', timestamp: Date.now() },
    };
  } else {
    evalUrl = `${factoryUrl}/api/eval`;
    body = {
      spec: { _tsSource: source, _specType: 'ts' },
      telemetry: { source: 'game-studio-cli', timestamp: Date.now() },
    };
  }

  const resp = await fetch(evalUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Eval failed (${resp.status}): ${err}`);
  }

  const result = await resp.json();

  // Display results
  console.log('\n── Eval Results ──────────────────────────────');
  console.log(`  Score: ${result.score}/100 ${result.score >= 80 ? '(PASS)' : '(NEEDS WORK)'}`);
  console.log(`  Analysis: ${result.analysis}`);

  if (result.bugs && result.bugs.length > 0) {
    console.log(`\n  Bugs found (${result.bugs.length}):`);
    for (let i = 0; i < result.bugs.length; i++) {
      console.log(`    ${i + 1}. ${result.bugs[i]}`);
    }
  } else {
    console.log('\n  No bugs found.');
  }

  if (result.vision_alignment) {
    console.log(`\n  Vision alignment: ${result.vision_alignment}`);
  }

  // Auto-fix if requested and score is low
  if (autoFix && result.score < 80 && result.fixed_spec) {
    console.log('\n── Applying fixes ───────────────────────────');
    if (result.fixed_spec._tsSource) {
      writeFileSync(gameFile, result.fixed_spec._tsSource);
      console.log('  Updated game.js with fixed version.');
      console.log('  Run "game-studio build" to rebuild.');
    } else {
      console.log('  Fixed spec returned but no TS source to apply.');
      writeFileSync(join(cwd, 'eval-result.json'), JSON.stringify(result, null, 2));
      console.log('  Full result saved to eval-result.json');
    }
  }

  // Save eval history
  const historyFile = join(cwd, '.eval-history.json');
  let history = [];
  if (existsSync(historyFile)) {
    try { history = JSON.parse(readFileSync(historyFile, 'utf-8')); } catch {}
  }
  history.push({
    timestamp: new Date().toISOString(),
    score: result.score,
    bugs: result.bugs?.length || 0,
    analysis: result.analysis,
  });
  writeFileSync(historyFile, JSON.stringify(history, null, 2) + '\n');

  return result;
}
