/**
 * game-studio init <name> — Scaffold a new game project.
 *
 * Creates:
 *   <name>/
 *     game.js              — Game source using @engine SDK
 *     game-studio.json     — Project config
 *     index.html           — Standalone playable page
 *     engine/              — Local copy of @engine SDK modules
 *     dist/                — (empty, populated by build)
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const GAME_TEMPLATE = `/**
 * {{NAME}} — TypeScript IL game spec using @engine SDK.
 *
 * Edit this file to build your game. Use the @engine modules:
 *   @engine/core   — defineGame(), components, resources, systems
 *   @engine/grid   — rotateShape, collides, clearLines, wrapPosition, etc.
 *   @engine/render — drawGridBoard, drawPieceCells, drawSnake, drawHUD, etc.
 *   @engine/board  — buildBoardMap, isLegalMove (for board games)
 *   @engine/input  — consumeAction, moveCursor
 *
 * To build:   game-studio build
 * To eval:    game-studio eval
 * To publish: game-studio publish
 */

import { defineGame } from '@engine/core';
import { consumeAction } from '@engine/input';
import { clearCanvas, drawBorder, drawHUD, drawGameOver } from '@engine/render';

const COLS = 10;
const ROWS = 10;
const CELL_SIZE = 40;

const game = defineGame({
  display: {
    type: 'grid',
    width: COLS,
    height: ROWS,
    cellSize: CELL_SIZE,
    background: '#111',
  },
  input: {
    up:      { keys: ['ArrowUp', 'w'] },
    down:    { keys: ['ArrowDown', 's'] },
    left:    { keys: ['ArrowLeft', 'a'] },
    right:   { keys: ['ArrowRight', 'd'] },
    action:  { keys: [' ', 'Enter'] },
    restart: { keys: ['r', 'R'] },
  },
});

game.component('Position', { x: 0, y: 0 });

game.resource('state', {
  score: 0,
  level: 1,
  gameOver: false,
});

// --- Spawn System ---
game.system('spawn', function spawnSystem(world, _dt) {
  if (world.getResource('_spawned')) return;
  world.setResource('_spawned', true);

  // TODO: Create your initial entities here
  const eid = world.createEntity();
  world.addComponent(eid, 'Position', { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) });
});

// --- Input System ---
game.system('input', function inputSystem(world, _dt) {
  const state = world.getResource('state');
  if (state.gameOver) return;
  const input = world.getResource('input');

  // TODO: Handle input here
  if (consumeAction(input, 'action')) {
    state.score += 1;
  }
});

// --- Render System ---
game.system('render', function renderSystem(world, _dt) {
  const renderer = world.getResource('renderer');
  if (!renderer) return;
  const { ctx, cellSize, offsetX, offsetY } = renderer;
  const state = world.getResource('state');
  const W = COLS * cellSize;
  const H = ROWS * cellSize;

  clearCanvas(ctx, '#111');
  drawBorder(ctx, offsetX, offsetY, W, H, '#333');

  // TODO: Draw your game here

  drawHUD(ctx, state, offsetX, W, offsetY, {
    fields: ['score', 'level'],
    fontSize: 18,
  });

  if (state && state.gameOver) {
    drawGameOver(ctx, offsetX, offsetY, W, H, {
      title: 'GAME OVER',
      subtitle: 'Press R to restart',
    });
  }
});

export default game;
`;

const INDEX_HTML = `<!DOCTYPE html>
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

export default async function init({ args, cwd }) {
  const name = args[0];
  if (!name) {
    console.error('Usage: game-studio init <name>');
    console.error('Example: game-studio init my-platformer');
    process.exit(1);
  }

  const dir = join(cwd, name);
  if (existsSync(dir)) {
    console.error(`Directory "${name}" already exists.`);
    process.exit(1);
  }

  console.log(`Creating game project: ${name}`);

  mkdirSync(join(dir, 'dist'), { recursive: true });
  mkdirSync(join(dir, 'engine'), { recursive: true });
  mkdirSync(join(dir, 'assets'), { recursive: true });

  // Game source
  writeFileSync(join(dir, 'game.js'), GAME_TEMPLATE.replace(/\{\{NAME\}\}/g, name));

  // Config
  const config = {
    name,
    factory: 'http://localhost:3000',
    github: { owner: '', repo: name },
    engine: { version: 'latest' },
  };
  writeFileSync(join(dir, 'game-studio.json'), JSON.stringify(config, null, 2) + '\n');

  // index.html
  writeFileSync(join(dir, 'index.html'), INDEX_HTML.replace(/\{\{NAME\}\}/g, name));

  // .gitignore
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n');

  console.log(`
  Created ${name}/ with:
    game.js            — Your game source (edit this!)
    game-studio.json   — Project config
    index.html         — Playable standalone page (with title card overlay)
    engine/            — @engine SDK (run "game-studio pull-sdk" to populate)
    assets/            — Game assets (run "game-studio title-card" to generate)
    dist/              — Built bundles (run "game-studio build")

  Next steps:
    cd ${name}
    game-studio pull-sdk    # Get latest engine SDK
    game-studio build       # Bundle your game
    game-studio serve       # Play locally at http://localhost:8080
  `);
}
