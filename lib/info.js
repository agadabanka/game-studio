/**
 * game-studio info — Show project info and architecture.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export default async function info({ cwd, config, factoryUrl }) {
  console.log('\n── Project Info ─────────────────────────────');
  console.log(`  Name:     ${config.name || '(not set)'}`);
  console.log(`  Factory:  ${factoryUrl}`);

  if (config.github?.owner) {
    console.log(`  GitHub:   ${config.github.owner}/${config.github.repo || config.name}`);
  }

  const gameFile = join(cwd, 'game.js');
  if (existsSync(gameFile)) {
    const source = readFileSync(gameFile, 'utf-8');
    console.log(`  Source:   game.js (${source.length} bytes)`);
  }

  const bundleFile = join(cwd, 'dist/game.bundle.js');
  if (existsSync(bundleFile)) {
    const bundle = readFileSync(bundleFile, 'utf-8');
    console.log(`  Bundle:   dist/game.bundle.js (${bundle.length} bytes)`);
  } else {
    console.log('  Bundle:   (not built — run "game-studio build")');
  }

  const historyFile = join(cwd, '.eval-history.json');
  if (existsSync(historyFile)) {
    const history = JSON.parse(readFileSync(historyFile, 'utf-8'));
    const latest = history[history.length - 1];
    console.log(`  Last eval: score ${latest.score}/100, ${latest.bugs} bugs (${latest.timestamp})`);
  }

  console.log(`
── Architecture ─────────────────────────────

  You (Claude Code)                Game Factory (Server)
  ┌─────────────────┐              ┌──────────────────────┐
  │  game-studio    │              │                      │
  │  CLI            │─── pull ────▶│  /api/sdk            │
  │                 │   (engine    │  @engine modules     │
  │  game.js        │    SDK)      │                      │
  │  ┌───────────┐  │              │  /api/compile        │
  │  │ @engine/* │  │─── build ──▶│  esbuild-wasm        │
  │  │  imports  │  │   (bundle)   │  bundler             │
  │  └───────────┘  │              │                      │
  │                 │              │  /api/eval            │
  │  dist/          │─── eval ───▶│  Claude QA            │
  │  game.bundle.js │  (quality)   │  scoring + fixes     │
  │                 │              │                      │
  │                 │─── fix ────▶│  /api/fix-issues      │
  │                 │  (auto-fix)  │  Claude + GitHub      │
  └────────┬────────┘              └──────────┬───────────┘
           │                                  │
           │ publish                          │ learnings
           ▼                                  ▼
  ┌─────────────────┐              ┌──────────────────────┐
  │  GitHub Repo    │              │  Common Libraries    │
  │  (your game)    │              │  (battle-hardened)   │
  │                 │              │                      │
  │  game.js        │              │  @engine/core.js     │
  │  dist/bundle.js │              │  @engine/grid.js     │
  │  index.html     │              │  @engine/render.js   │
  │  README.md      │              │  @engine/board.js    │
  └─────────────────┘              │  @engine/input.js    │
                                   └──────────────────────┘
           │                                  │
           │    Learnings feed back           │
           └──────────────────────────────────┘
               Eval bugs → compiler issues
               Fixed patterns → SDK updates
               Quality scores → library vetting
`);
}
