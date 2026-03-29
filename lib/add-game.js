/**
 * game-studio add-game — Register a new game and sync everything.
 *
 * This is the PROGRAMMATIC interface for adding games. It:
 *   1. Validates the game source exists (games/<name>/game.js)
 *   2. Adds the game to games.json (single source of truth)
 *   3. Scaffolds game-studio.json + index.html if missing
 *   4. Runs `game-studio sync` to propagate everywhere
 *
 * Usage:
 *   game-studio add-game pac-man --genre arcade --modules core,grid,render,input,ai --systems 7 --size ~20KB
 *
 * The game source (games/<name>/game.js) must already exist.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STUDIO_ROOT = join(__dirname, '..');

const INDEX_HTML_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>{{NAME}} — Game Studio</title>
<style>
  body { margin: 0; background: #111; display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: monospace; }
  canvas { display: block; border-radius: 4px; }
  .controls { position: fixed; bottom: 20px; color: #666; font-size: 12px; text-align: center; }
  #title-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: #000; display: flex; justify-content: center; align-items: center;
    z-index: 1000; cursor: pointer; transition: opacity 0.5s ease;
    flex-direction: column;
  }
  #title-overlay.hidden { opacity: 0; pointer-events: none; }
  #title-overlay img {
    max-width: 90%; max-height: 80vh; object-fit: contain;
    border-radius: 8px; box-shadow: 0 0 40px rgba(59,130,246,0.3);
  }
  #title-overlay .start-hint {
    position: absolute; bottom: 40px; color: #888; font-size: 14px;
    font-family: monospace; animation: blink 1.5s infinite;
  }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
</style>
</head>
<body>
<div id="title-overlay">
  <img src="assets/title-card.png" alt="{{NAME}} Title Card"
       onerror="document.getElementById('title-overlay').style.display='none'">
  <div class="start-hint">Click or press any key to play</div>
</div>
<canvas id="game-canvas"></canvas>
<div class="controls">Arrow keys: move | Space: action | R: restart</div>
<script type="module">
  import game from './dist/game.bundle.js';
  game.start(document.getElementById('game-canvas'));

  const overlay = document.getElementById('title-overlay');
  if (overlay) {
    function dismissTitle() {
      overlay.classList.add('hidden');
      setTimeout(() => overlay.style.display = 'none', 500);
      document.removeEventListener('keydown', dismissTitle);
      overlay.removeEventListener('click', dismissTitle);
    }
    overlay.addEventListener('click', dismissTitle);
    document.addEventListener('keydown', dismissTitle);
  }
</script>
</body>
</html>
`;

function parseArgs(args) {
  const result = { name: null, genre: null, modules: [], systems: 4, size: '~15KB', displayName: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--genre' && args[i + 1]) {
      result.genre = args[++i];
    } else if (args[i] === '--modules' && args[i + 1]) {
      result.modules = args[++i].split(',').map(m => m.trim());
    } else if (args[i] === '--systems' && args[i + 1]) {
      result.systems = parseInt(args[++i]);
    } else if (args[i] === '--size' && args[i + 1]) {
      result.size = args[++i];
    } else if (args[i] === '--display-name' && args[i + 1]) {
      result.displayName = args[++i];
    } else if (!args[i].startsWith('-')) {
      result.name = args[i];
    }
  }

  return result;
}

export default async function addGame({ args }) {
  const opts = parseArgs(args);

  if (!opts.name) {
    console.error(`Usage: game-studio add-game <name> --genre <genre> --modules core,render,input [--systems 5] [--size ~16KB] [--display-name "My Game"]

Required:
  <name>          Game directory name (e.g., pac-man)
  --genre         One of: board, puzzle, arcade, card, strategy, casual
  --modules       Comma-separated @engine modules used

Optional:
  --systems       Number of ECS systems (default: 4)
  --size          Estimated bundle size (default: ~15KB)
  --display-name  Human-readable name (default: derived from dir name)

Example:
  game-studio add-game pac-man --genre arcade --modules core,grid,render,input,ai --systems 7 --size ~20KB

The game source must exist at games/<name>/game.js
`);
    process.exit(1);
  }

  if (!opts.genre) {
    console.error('Error: --genre is required. Options: board, puzzle, arcade, card, strategy, casual');
    process.exit(1);
  }

  if (opts.modules.length === 0) {
    console.error('Error: --modules is required. Example: --modules core,render,input');
    process.exit(1);
  }

  const gameName = opts.name;
  const gameDir = join(STUDIO_ROOT, 'games', gameName);
  const gameJs = join(gameDir, 'game.js');

  // Check game source exists
  if (!existsSync(gameJs)) {
    console.error(`Error: games/${gameName}/game.js not found.`);
    console.error(`Create the game source first, then run add-game to register it.`);
    process.exit(1);
  }

  // Read registry
  const registryPath = join(STUDIO_ROOT, 'games.json');
  const registry = JSON.parse(readFileSync(registryPath, 'utf-8'));

  // Check for duplicates
  if (registry.games.find(g => g.repo === gameName)) {
    console.error(`Error: Game "${gameName}" already exists in registry.`);
    process.exit(1);
  }

  // Validate genre
  if (!registry.genres[opts.genre]) {
    console.error(`Error: Unknown genre "${opts.genre}". Options: ${Object.keys(registry.genres).join(', ')}`);
    process.exit(1);
  }

  // Validate modules
  for (const mod of opts.modules) {
    if (!registry.sdkModules[mod]) {
      console.error(`Error: Unknown module "${mod}". Options: ${Object.keys(registry.sdkModules).join(', ')}`);
      process.exit(1);
    }
  }

  // Derive display name
  const displayName = opts.displayName || gameName
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // Determine batch number
  const maxBatch = Math.max(...registry.games.map(g => g.batch || 1));
  const batch = maxBatch;

  // Add to registry
  const newEntry = {
    name: displayName,
    repo: gameName,
    genre: opts.genre,
    modules: opts.modules,
    size: opts.size,
    systems: opts.systems,
    batch,
  };

  registry.games.push(newEntry);
  registry.totalGames = registry.games.length;

  writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
  console.log(`  Added "${displayName}" to games.json (game #${registry.totalGames})`);

  // Scaffold game-studio.json if missing
  const configPath = join(gameDir, 'game-studio.json');
  if (!existsSync(configPath)) {
    const config = {
      name: gameName,
      factory: 'http://localhost:3000',
      github: { owner: 'agadabanka', repo: gameName },
      engine: { version: 'latest' },
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    console.log(`  Created games/${gameName}/game-studio.json`);
  }

  // Scaffold index.html if missing
  const htmlPath = join(gameDir, 'index.html');
  if (!existsSync(htmlPath)) {
    writeFileSync(htmlPath, INDEX_HTML_TEMPLATE.replace(/\{\{NAME\}\}/g, displayName));
    console.log(`  Created games/${gameName}/index.html`);
  }

  // Create assets dir
  const assetsDir = join(gameDir, 'assets');
  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
  }

  console.log(`\n  Game "${displayName}" registered successfully.`);
  console.log(`  Run "game-studio sync" to propagate to README, CLAUDE.md, and build system.`);
  console.log(`  Run "game-studio publish" from games/${gameName}/ to push to GitHub.\n`);
}
