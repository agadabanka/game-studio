/**
 * vision-diff/index.js — Main entry point for the vision-diff validation loop.
 *
 * Orchestrates the full pipeline:
 *   1. Generate reference keyframes (Option A: AI-generated via Gemini)
 *   2. Compile & run game → capture aligned frames
 *   3. Tiered delta computation (scene graph → pHash → color → VLM)
 *   4. Three specialized validators (aesthetics, layout, gameplay)
 *   5. ECS diff generation → targeted patches
 *   6. Apply patches → loop
 *
 * Usage:
 *   import { visionDiffLoop } from './vision-diff/index.js';
 *   const result = await visionDiffLoop(gameSource, 'Tetris clone', 'arcade', {
 *     factoryUrl: 'https://game-factory.example.com',
 *     maxIterations: 3,
 *   });
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { generateReferenceKeyframes, referenceCacheKey, computePHash, extractColorMoments } from './references.js';
import { computeAllDeltas } from './compare.js';
import { runValidators, aggregateIssues } from './validators.js';
import { generateECSDiffs, applyPatches } from './diff.js';

/**
 * Snapshot ECS state from a running game world.
 * This extracts the full entity/component/resource state for structural comparison.
 *
 * In the browser (Game Factory), this runs inside the game iframe.
 * For CLI, this would run via a headless evaluator.
 */
export function snapshotECSState(world) {
  const entities = {};
  // Query all entities by iterating known component types
  const knownComponents = ['Position', 'Sprite', 'Velocity', 'Grid', 'Board',
    'Piece', 'Ghost', 'Score', 'Timer', 'Input', 'Render'];

  const seenEntities = new Set();
  for (const compName of knownComponents) {
    try {
      const eids = world.query(compName);
      for (const eid of eids) {
        if (!seenEntities.has(eid)) {
          seenEntities.add(eid);
          entities[eid] = {};
        }
        entities[eid][compName] = world.getComponent(eid, compName);
      }
    } catch { /* component not registered */ }
  }

  return {
    entities,
    entityCount: seenEntities.size,
    resources: {
      state: safeGet(world, 'state'),
      board: safeGet(world, 'board'),
      display: safeGet(world, 'display'),
    },
    timestamp: Date.now(),
  };
}

function safeGet(world, name) {
  try { return world.getResource(name); } catch { return null; }
}

/**
 * Run the full vision-diff validation loop.
 *
 * @param {string} gameSource - game.js source code
 * @param {string} gameDescription - Human-readable description (e.g., "Tetris clone")
 * @param {string} gameType - 'arcade' | 'board' | 'puzzle'
 * @param {object} options
 * @param {string} options.factoryUrl - Game Factory server URL
 * @param {number} [options.maxIterations=3] - Max fix iterations
 * @param {string} [options.geminiApiKey] - Gemini API key for image generation
 * @param {string} [options.cwd] - Working directory
 * @param {string} [options.projectId] - Game Factory project ID
 * @returns {object} { source, iterations, deltas, patches, score }
 */
export async function visionDiffLoop(gameSource, gameDescription, gameType, options = {}) {
  const { factoryUrl, maxIterations = 3, geminiApiKey, cwd, projectId } = options;

  console.log('\n══ Vision-Diff Validation Loop ══════════════════');
  console.log(`  Game: ${gameDescription} (${gameType})`);
  console.log(`  Max iterations: ${maxIterations}`);
  console.log(`  Factory: ${factoryUrl}`);

  // ── Step 1: Generate reference keyframes (cached) ──
  console.log('\n── Step 1: Generating reference keyframes ──');
  const cacheKey = referenceCacheKey(gameDescription, gameType);
  const cachePath = cwd ? join(cwd, `.vision-diff-cache-${cacheKey}.json`) : null;

  let references;
  if (cachePath && existsSync(cachePath)) {
    console.log('  Using cached references');
    references = JSON.parse(readFileSync(cachePath, 'utf-8'));
  } else {
    references = await generateReferenceKeyframes(gameDescription, gameType, {
      geminiApiKey,
      factoryUrl,
    });
    if (cachePath) {
      // Cache without full base64 images (save disk, keep compact representations)
      const cacheData = references.map(r => ({
        ...r,
        imageBase64: r.imageBase64 ? '<cached>' : null,
      }));
      writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
    }
    console.log(`  Generated ${references.length} reference keyframes`);
  }

  // ── Iteration loop ──
  let currentSource = gameSource;
  const history = [];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    console.log(`\n── Iteration ${iteration + 1}/${maxIterations} ────────────────────`);

    // ── Step 2: Compile and run game ──
    console.log('  Compiling game...');
    let compileResult;
    const compileUrl = projectId
      ? `${factoryUrl}/api/projects/${projectId}/eval`
      : `${factoryUrl}/api/compile`;

    try {
      const resp = await fetch(compileUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: currentSource,
          spec: { _tsSource: currentSource, _specType: 'ts' },
          telemetry: { source: 'vision-diff-loop', iteration },
        }),
      });

      if (!resp.ok) throw new Error(`Compile failed: ${resp.status}`);
      compileResult = await resp.json();
    } catch (err) {
      console.error(`  Compile error: ${err.message}`);
      break;
    }

    // ── Step 3: Capture frames ──
    // In the server/browser context, captureScreenshot() and AutoPlayer handle this.
    // For CLI, we get the screenshot from the eval response.
    console.log('  Capturing gameplay frames...');
    const captures = references.map(ref => ({
      refId: ref.id,
      imageBase64: compileResult.screenshot || null,
      ecsState: compileResult.ecsState || null,
      sceneGraph: compileResult.analysis || null,
      pHash: compileResult.screenshot ? computePHash(compileResult.screenshot) : null,
      colorMoments: compileResult.screenshot ? extractColorMoments(compileResult.screenshot) : null,
    }));

    // ── Step 4: Compute deltas (tiered) ──
    console.log('  Computing visual deltas...');
    const { deltas, summary } = computeAllDeltas(references, captures);
    console.log(`  Results: ${summary.matched} matched, ${summary.minor} minor, ${summary.needsReview} need review`);

    // ── Step 5: Run validators on frames needing review ──
    const needsReview = deltas.filter(d => d.needsDeepAnalysis);
    if (needsReview.length === 0) {
      console.log('\n  All keyframes match references — validation complete!');
      history.push({ iteration: iteration + 1, deltas: summary, patches: 0, verdict: 'PASS' });
      break;
    }

    console.log(`  Running 3 validators on ${needsReview.length} keyframes...`);
    const allIssues = [];

    for (const delta of needsReview) {
      const ref = references.find(r => r.id === delta.refId);
      const actual = captures.find(c => c.refId === delta.refId);
      if (!ref || !actual) continue;

      const validations = await runValidators(ref, actual, factoryUrl);
      const issues = aggregateIssues(validations);
      allIssues.push(...issues);

      console.log(`    ${delta.refId}: ${issues.length} issues (${validations.aesthetics?.overall || '?'} / ${validations.layout?.overall || '?'} / ${validations.gameplay?.overall || '?'})`);
    }

    if (allIssues.length === 0) {
      console.log('  No actionable issues found.');
      history.push({ iteration: iteration + 1, deltas: summary, patches: 0, verdict: 'PASS' });
      break;
    }

    // ── Step 6: Generate ECS diffs ──
    console.log(`\n  Generating ECS patches for ${allIssues.length} issues...`);
    const { patches, summary: patchSummary } = await generateECSDiffs(currentSource, allIssues, factoryUrl);

    if (patches.length === 0) {
      console.log('  No patches generated. Stopping loop.');
      history.push({ iteration: iteration + 1, deltas: summary, patches: 0, issues: allIssues.length, verdict: 'STUCK' });
      break;
    }

    // ── Step 7: Apply patches ──
    console.log(`  Applying ${patches.length} patches...`);
    currentSource = applyPatches(currentSource, patches);

    history.push({
      iteration: iteration + 1,
      deltas: summary,
      patches: patches.length,
      issues: allIssues.length,
      patchSummary,
      verdict: 'PATCHED',
    });
  }

  // ── Summary ──
  console.log('\n══ Vision-Diff Summary ══════════════════════════');
  for (const h of history) {
    console.log(`  Iteration ${h.iteration}: ${h.verdict} (${h.patches} patches, ${h.deltas.needsReview} reviewed)`);
  }

  return {
    source: currentSource,
    iterations: history.length,
    history,
    references: references.map(r => ({ id: r.id, scene: r.scene })),
  };
}

/**
 * Initialize a vision-diff run — generate reference keyframes.
 * This is the same "init" step that Game Factory's /api/vision-hill-climb/init calls.
 *
 * @param {string} gameDescription - Game name/description
 * @param {string} gameType - 'arcade' | 'board' | 'puzzle'
 * @param {object} options - { geminiApiKey, factoryUrl, cwd }
 * @returns {object} { references, cacheKey }
 */
export async function initRun(gameDescription, gameType, options = {}) {
  const { geminiApiKey, factoryUrl, cwd } = options;
  const cacheKey = referenceCacheKey(gameDescription, gameType);
  const cachePath = cwd ? join(cwd, `.vision-diff-cache-${cacheKey}.json`) : null;

  let references;
  if (cachePath && existsSync(cachePath)) {
    references = JSON.parse(readFileSync(cachePath, 'utf-8'));
  } else {
    references = await generateReferenceKeyframes(gameDescription, gameType, {
      geminiApiKey, factoryUrl,
    });
    if (cachePath) {
      const cacheData = references.map(r => ({
        ...r, imageBase64: r.imageBase64 ? '<cached>' : null,
      }));
      writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
    }
  }

  return { references, cacheKey };
}

/**
 * Run a single iteration of the vision-diff loop.
 * This is the same "iterate" step that Game Factory's /api/vision-hill-climb/iterate calls.
 *
 * @param {string} source - Current game.js source
 * @param {object[]} references - Reference keyframes from initRun()
 * @param {object} options - { factoryUrl, screenshot }
 * @returns {object} { patchedSource, patches, issues, deltas, verdict, sourceChanged }
 */
export async function iterateRun(source, references, options = {}) {
  const { factoryUrl, screenshot } = options;

  // Compile
  let compileResult;
  try {
    const resp = await fetch(`${factoryUrl}/api/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    });
    if (!resp.ok) throw new Error(`Compile failed: ${resp.status}`);
    compileResult = await resp.json();
  } catch (err) {
    return { patchedSource: source, patches: [], issues: [], verdict: 'COMPILE_FAIL', error: err.message, sourceChanged: false };
  }

  // Capture frames
  const captures = references.map(ref => ({
    refId: ref.id,
    imageBase64: screenshot || compileResult.screenshot || null,
    ecsState: compileResult.ecsState || null,
    sceneGraph: compileResult.analysis || null,
    pHash: (screenshot || compileResult.screenshot) ? computePHash(screenshot || compileResult.screenshot) : null,
    colorMoments: (screenshot || compileResult.screenshot) ? extractColorMoments(screenshot || compileResult.screenshot) : null,
  }));

  // Compute deltas
  const { deltas, summary } = computeAllDeltas(references, captures);

  // Run validators on frames needing review
  const needsReview = deltas.filter(d => d.needsDeepAnalysis);
  if (needsReview.length === 0) {
    return { patchedSource: source, patches: [], issues: [], deltas: summary, verdict: 'PASS', sourceChanged: false };
  }

  const allIssues = [];
  for (const delta of needsReview) {
    const ref = references.find(r => r.id === delta.refId);
    const actual = captures.find(c => c.refId === delta.refId);
    if (!ref || !actual) continue;
    const validations = await runValidators(ref, actual, factoryUrl);
    allIssues.push(...aggregateIssues(validations));
  }

  if (allIssues.length === 0) {
    return { patchedSource: source, patches: [], issues: [], deltas: summary, verdict: 'PASS', sourceChanged: false };
  }

  // Generate and apply patches
  const { patches } = await generateECSDiffs(source, allIssues, factoryUrl);
  if (patches.length === 0) {
    return { patchedSource: source, patches: [], issues: allIssues.length, deltas: summary, verdict: 'STUCK', sourceChanged: false };
  }

  const patchedSource = applyPatches(source, patches);
  return {
    patchedSource,
    patches: patches.length,
    issues: allIssues.length,
    deltas: summary,
    verdict: 'PATCHED',
    sourceChanged: patchedSource !== source,
  };
}

/**
 * CLI entry point — integrates with game-studio eval --vision-diff
 */
export default async function visionDiffEval({ args, cwd, config, factoryUrl }) {
  const gameFile = join(cwd, 'game.js');
  if (!existsSync(gameFile)) {
    throw new Error('No game.js found.');
  }

  const source = readFileSync(gameFile, 'utf-8');
  const gameType = args.find((_, i) => args[i - 1] === '--type') || config.gameType || 'arcade';
  const gameName = config.name || 'game';
  const maxIter = parseInt(args.find((_, i) => args[i - 1] === '--iterations') || '3', 10);
  const projectId = args.find((_, i) => args[i - 1] === '--project') || config.projectId;

  const result = await visionDiffLoop(source, gameName, gameType, {
    factoryUrl,
    maxIterations: maxIter,
    geminiApiKey: process.env.GEMINI_API_KEY,
    cwd,
    projectId,
  });

  // Write back if source was modified
  if (result.source !== source) {
    writeFileSync(gameFile, result.source);
    console.log(`\n  Updated game.js (${result.iterations} iterations, ${result.source.length} bytes)`);
    console.log('  Run "game-studio build" to rebuild.');
  }

  // Save history
  const historyFile = join(cwd, '.vision-diff-history.json');
  let history = [];
  if (existsSync(historyFile)) {
    try { history = JSON.parse(readFileSync(historyFile, 'utf-8')); } catch {}
  }
  history.push({
    timestamp: new Date().toISOString(),
    game: gameName,
    type: gameType,
    iterations: result.iterations,
    history: result.history,
  });
  writeFileSync(historyFile, JSON.stringify(history, null, 2) + '\n');

  return result;
}
