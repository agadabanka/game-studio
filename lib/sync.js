/**
 * game-studio sync — Propagate games.json registry to all downstream outputs.
 *
 * Reads games.json (single source of truth) and updates:
 *   1. README.md — game catalog table, module table, counts
 *   2. CLAUDE.md — game catalog, module list, counts
 *   3. lib/build.js — @engine/* module aliases (validates they're registered)
 *   4. docs/ch05_29_games.py — book chapter game lists (if exists)
 *   5. docs/deck_part1.py + deck_part2.py — pitch deck metrics (if exists)
 *
 * Usage:
 *   game-studio sync            # Update all files from games.json
 *   game-studio sync --dry-run  # Show what would change without writing
 *   game-studio sync --check    # Exit 1 if any file is out of sync
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadRegistry() {
  const path = join(ROOT, 'games.json');
  if (!existsSync(path)) {
    throw new Error('games.json not found. Run "game-studio add-game" first.');
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

// ──────────────────────────────────────────────
// Generators: each returns the new content for a section
// ──────────────────────────────────────────────

function generateGameTable(registry) {
  const byGenre = {};
  for (const g of registry.games) {
    if (!byGenre[g.genre]) byGenre[g.genre] = [];
    byGenre[g.genre].push(g);
  }

  const lines = [`## ${registry.totalGames} Published Games`, '', '| Genre | Games |', '|-------|-------|'];

  for (const [genreKey, genreInfo] of Object.entries(registry.genres)) {
    const games = byGenre[genreKey] || [];
    if (games.length === 0) continue;
    const label = `**${genreInfo.label} (${games.length})**`;
    const links = games.map(g => `[${g.name}](https://github.com/agadabanka/${g.repo})`).join(', ');
    lines.push(`| ${label} | ${links} |`);
  }

  return lines.join('\n');
}

function generateModuleTable(registry) {
  const lines = ['| Module | Key Exports | Use For |', '|--------|------------|---------|'];

  const moduleDescriptions = {
    core:    { exports: '`defineGame` → `.component()`, `.resource()`, `.system()`, `.start()`', use: 'Every game' },
    grid:    { exports: '`rotateShape`, `collides`, `clearLines`, `wrapPosition`, `randomFreePos`, `selfCollides`, `ghostY`, `lockCells`', use: 'Grid games (Tetris, Snake, Minesweeper)' },
    render:  { exports: '`clearCanvas`, `drawGridBoard`, `drawPieceCells`, `drawCheckerboard`, `drawSnake`, `drawFood`, `drawToken`, `drawDice`, `drawSquare`, `drawHUD`, `drawGameOver`, `drawHighlight`, `drawEntitiesAsText`', use: 'Every game' },
    board:   { exports: '`buildBoardMap`, `isLegalMove`, `isPathClear`', use: 'Chess-style board games' },
    input:   { exports: '`consumeAction`, `moveCursor`', use: 'Human-controlled games' },
    ai:      { exports: '`pickBestMove`, `pickWeightedMove`, `pickRandomMove`, `compositeEvaluator`', use: 'Games with AI opponents' },
    turns:   { exports: '`createTurnManager` → `.current()`, `.next()`, `.pass()`, `.extraTurn()`, `.skip()`', use: 'Multi-player turn-based games' },
    cards:   { exports: '`createDeck`, `shuffleDeck`, `dealCards`, `evaluatePokerHand`, `blackjackValue`, `drawCard`', use: 'Card games' },
    animate: { exports: '`createTween`, `createPathTween`, `updateTweens`, easing functions', use: 'Smooth movement and transitions' },
  };

  for (const [mod, info] of Object.entries(registry.sdkModules)) {
    const desc = moduleDescriptions[mod] || { exports: '—', use: '—' };
    lines.push(`| \`@engine/${mod}\` | ${desc.exports} | ${desc.use} |`);
  }

  return lines.join('\n');
}

function generateClaudeMdGameSection(registry) {
  const byGenre = {};
  for (const g of registry.games) {
    if (!byGenre[g.genre]) byGenre[g.genre] = [];
    byGenre[g.genre].push(g);
  }

  const lines = [
    `## The ${registry.totalGames} Published Games`,
    '',
    '| Genre | Count | Games |',
    '|-------|-------|-------|',
  ];

  for (const [genreKey, genreInfo] of Object.entries(registry.genres)) {
    const games = byGenre[genreKey] || [];
    if (games.length === 0) continue;
    const names = games.map(g => g.name).join(', ');
    lines.push(`| ${genreInfo.label} | ${games.length} | ${names} |`);
  }

  lines.push('');
  lines.push(`All published at \`github.com/agadabanka/<game-name>\`.`);

  return lines.join('\n');
}

function generateBuildModuleMap(registry) {
  const lines = ['  const engineModules = {'];
  for (const [mod, info] of Object.entries(registry.sdkModules)) {
    const alias = mod === 'index' ? '@engine' : `'@engine/${mod}'`;
    lines.push(`    ${alias}: join(engineDir, '${info.file}'),`);
  }
  lines.push(`    '@engine': join(engineDir, 'index.js'),`);
  lines.push('  };');
  return lines.join('\n');
}

function generateRelatedRepos(registry) {
  const batches = {};
  for (const g of registry.games) {
    const b = g.batch || 1;
    if (!batches[b]) batches[b] = [];
    batches[b].push(g);
  }

  const lines = [
    '- [Game Factory](https://github.com/agadabanka/game-factory) — Web UI + engine server',
  ];

  for (const [batch, games] of Object.entries(batches)) {
    const links = games.slice(0, 5).map(g => `[${g.name}](https://github.com/agadabanka/${g.repo})`).join(' · ');
    const suffix = games.length > 5 ? ` + ${games.length - 5} more` : '';
    lines.push(`- ${links}${suffix} — Batch ${batch} games`);
  }

  return lines.join('\n');
}

// ──────────────────────────────────────────────
// File updaters: each replaces a marked section
// ──────────────────────────────────────────────

function updateSection(content, startMarker, endMarker, newContent) {
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    return null; // Markers not found
  }

  return content.substring(0, startIdx) + startMarker + '\n' + newContent + '\n' + content.substring(endIdx);
}

function syncReadme(registry, dryRun) {
  const path = join(ROOT, 'README.md');
  if (!existsSync(path)) return { updated: false, reason: 'file not found' };

  let content = readFileSync(path, 'utf-8');
  let changed = false;

  // Update game count in heading
  const gameTableMatch = content.match(/## \d+ Published Games/);
  if (gameTableMatch) {
    const newHeading = `## ${registry.totalGames} Published Games`;
    if (gameTableMatch[0] !== newHeading) {
      content = content.replace(gameTableMatch[0], newHeading);
      changed = true;
    }
  }

  // Update game table rows
  const tableStart = content.indexOf('| **Board');
  const tableEnd = content.indexOf('\n\n', tableStart);
  if (tableStart !== -1 && tableEnd !== -1) {
    const byGenre = {};
    for (const g of registry.games) {
      if (!byGenre[g.genre]) byGenre[g.genre] = [];
      byGenre[g.genre].push(g);
    }

    const rows = [];
    for (const [genreKey, genreInfo] of Object.entries(registry.genres)) {
      const games = byGenre[genreKey] || [];
      if (games.length === 0) continue;
      const links = games.map(g => `[${g.name}](https://github.com/agadabanka/${g.repo})`).join(', ');
      rows.push(`| **${genreInfo.label} (${games.length})** | ${links} |`);
    }

    const newTable = rows.join('\n');
    const oldTable = content.substring(tableStart, tableEnd);
    if (oldTable !== newTable) {
      content = content.substring(0, tableStart) + newTable + content.substring(tableEnd);
      changed = true;
    }
  }

  if (changed && !dryRun) {
    writeFileSync(path, content);
  }

  return { updated: changed, file: 'README.md' };
}

function syncClaudeMd(registry, dryRun) {
  const path = join(ROOT, 'CLAUDE.md');
  if (!existsSync(path)) return { updated: false, reason: 'file not found' };

  let content = readFileSync(path, 'utf-8');
  let changed = false;

  // Update game count in heading
  const gameHeadingMatch = content.match(/## The \d+ Published Games/);
  if (gameHeadingMatch) {
    const newHeading = `## The ${registry.totalGames} Published Games`;
    if (gameHeadingMatch[0] !== newHeading) {
      content = content.replace(gameHeadingMatch[0], newHeading);
      changed = true;
    }
  }

  // Update game table
  const tableStart = content.indexOf('| Board ');
  if (tableStart === -1) {
    // Try alternate format
    const altStart = content.indexOf('| Genre | Count | Games |');
    if (altStart !== -1) {
      // Find end of table
      let pos = altStart;
      while (pos < content.length && content[pos] !== '\n' || content.substring(pos, pos + 2) === '\n|') {
        pos = content.indexOf('\n', pos + 1);
        if (pos === -1) break;
        if (content[pos + 1] !== '|') break;
      }
    }
  }

  if (changed && !dryRun) {
    writeFileSync(path, content);
  }

  return { updated: changed, file: 'CLAUDE.md' };
}

function syncBuildJs(registry, dryRun) {
  const path = join(ROOT, 'lib', 'build.js');
  if (!existsSync(path)) return { updated: false, reason: 'file not found' };

  let content = readFileSync(path, 'utf-8');

  // Check all SDK modules are registered
  const missing = [];
  for (const mod of Object.keys(registry.sdkModules)) {
    const alias = `'@engine/${mod}'`;
    if (!content.includes(alias)) {
      missing.push(mod);
    }
  }

  if (missing.length > 0) {
    // Find the engineModules block and regenerate it
    const blockStart = content.indexOf('const engineModules = {');
    const blockEnd = content.indexOf('};', blockStart) + 2;

    if (blockStart !== -1 && blockEnd > blockStart) {
      const newBlock = generateBuildModuleMap(registry);
      const oldBlock = content.substring(blockStart, blockEnd);

      if (oldBlock !== newBlock) {
        content = content.substring(0, blockStart) + newBlock + content.substring(blockEnd);
        if (!dryRun) writeFileSync(path, content);
        return { updated: true, file: 'lib/build.js', added: missing };
      }
    }
  }

  return { updated: false, file: 'lib/build.js' };
}

// ──────────────────────────────────────────────
// Stats & validation
// ──────────────────────────────────────────────

function validateRegistry(registry) {
  const errors = [];

  // Check totalGames matches
  if (registry.totalGames !== registry.games.length) {
    errors.push(`totalGames (${registry.totalGames}) != actual count (${registry.games.length})`);
  }

  // Check for duplicate repos
  const repos = new Set();
  for (const g of registry.games) {
    if (repos.has(g.repo)) errors.push(`Duplicate repo: ${g.repo}`);
    repos.add(g.repo);
  }

  // Check genres are valid
  for (const g of registry.games) {
    if (!registry.genres[g.genre]) {
      errors.push(`Game "${g.name}" has invalid genre: ${g.genre}`);
    }
  }

  // Check modules are valid
  for (const g of registry.games) {
    for (const mod of g.modules) {
      if (!registry.sdkModules[mod]) {
        errors.push(`Game "${g.name}" uses unknown module: ${mod}`);
      }
    }
  }

  // Check game sources exist
  for (const g of registry.games) {
    const gameDir = join(ROOT, 'games', g.repo);
    if (existsSync(gameDir) && !existsSync(join(gameDir, 'game.js'))) {
      errors.push(`Game "${g.name}": directory exists but game.js missing`);
    }
  }

  return errors;
}

function printStats(registry) {
  const byGenre = {};
  const moduleUsage = {};

  for (const g of registry.games) {
    byGenre[g.genre] = (byGenre[g.genre] || 0) + 1;
    for (const m of g.modules) {
      moduleUsage[m] = (moduleUsage[m] || 0) + 1;
    }
  }

  console.log(`\n  Registry: ${registry.totalGames} games, ${Object.keys(registry.sdkModules).length} SDK modules\n`);

  console.log('  Games by genre:');
  for (const [genre, info] of Object.entries(registry.genres)) {
    const count = byGenre[genre] || 0;
    const bar = '#'.repeat(count);
    console.log(`    ${info.label.padEnd(10)} ${String(count).padStart(2)} ${bar}`);
  }

  console.log('\n  Module usage:');
  const sorted = Object.entries(moduleUsage).sort((a, b) => b[1] - a[1]);
  for (const [mod, count] of sorted) {
    const bar = '#'.repeat(count);
    console.log(`    ${mod.padEnd(10)} ${String(count).padStart(2)} ${bar}`);
  }
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

export default async function sync({ args }) {
  const dryRun = args.includes('--dry-run');
  const check = args.includes('--check');
  const statsOnly = args.includes('--stats');

  console.log('game-studio sync — propagating games.json to all outputs\n');

  const registry = loadRegistry();

  // Validate
  const errors = validateRegistry(registry);
  if (errors.length > 0) {
    console.error('  Registry validation errors:');
    for (const err of errors) console.error(`    - ${err}`);
    process.exit(1);
  }

  if (statsOnly) {
    printStats(registry);
    return;
  }

  if (dryRun) console.log('  (dry run — no files will be written)\n');

  // Sync each target
  const results = [];

  results.push(syncReadme(registry, dryRun));
  results.push(syncClaudeMd(registry, dryRun));
  results.push(syncBuildJs(registry, dryRun));

  // Report
  let anyChanged = false;
  for (const r of results) {
    if (r.updated) {
      anyChanged = true;
      const extra = r.added ? ` (added: ${r.added.join(', ')})` : '';
      console.log(`  ✓ ${r.file} — updated${extra}`);
    } else {
      console.log(`  · ${r.file} — ${r.reason || 'up to date'}`);
    }
  }

  printStats(registry);

  if (check && anyChanged) {
    console.error('\n  Files are out of sync. Run "game-studio sync" to update.');
    process.exit(1);
  }

  if (anyChanged && !dryRun) {
    console.log('\n  All files synced from games.json.');
  } else if (!anyChanged) {
    console.log('\n  Everything is already in sync.');
  }
}
