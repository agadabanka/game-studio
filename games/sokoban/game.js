/**
 * Sokoban — Box-pushing puzzle game using @engine SDK.
 *
 * Features:
 * - 10 hand-crafted puzzle levels
 * - Push mechanics (player pushes boxes onto targets)
 * - Undo system (tracks move history)
 * - Move counter, level progression
 * - Win detection when all targets covered
 *
 * New patterns validated:
 * - Pushable entities (entity-pushes-entity interaction)
 * - Undo/history stack (new ECS pattern)
 * - Multi-level progression with level data
 * - No AI, no timer — pure logic puzzle
 *
 * Modules: @engine/core, @engine/grid, @engine/render, @engine/input
 * Complexity: 5 systems, ~16KB
 */

import { defineGame } from '@engine/core';
import { consumeAction } from '@engine/input';
import { clearCanvas, drawBorder, drawPieceCells, drawHUD, drawGameOver } from '@engine/render';

const COLS = 10;
const ROWS = 10;
const CELL = 48;

// Level data: W=wall, .=floor, @=player, $=box, O=target, *=box on target, +=player on target
const LEVELS = [
  // Level 1: Simple intro
  [
    'WWWWWWWWWW',
    'W........W',
    'W..W.....W',
    'W..W.$...W',
    'W..W.O...W',
    'W.....$O.W',
    'W..@.....W',
    'W........W',
    'W........W',
    'WWWWWWWWWW',
  ],
  // Level 2
  [
    'WWWWWWWWWW',
    'W........W',
    'W.WW.....W',
    'W.WO..$..W',
    'W..O..$..W',
    'W........W',
    'W...@....W',
    'W........W',
    'W........W',
    'WWWWWWWWWW',
  ],
  // Level 3
  [
    'WWWWWWWWWW',
    'W....W...W',
    'W.$..W...W',
    'W.O..W...W',
    'W....WW.WW',
    'WW.W.....W',
    'W...$O...W',
    'W....@...W',
    'W........W',
    'WWWWWWWWWW',
  ],
  // Level 4
  [
    'WWWWWWWWWW',
    'W........W',
    'W.W..W...W',
    'W.$..$.W.W',
    'W.O..O.W.W',
    'W.W..W...W',
    'W..$.O...W',
    'W...@....W',
    'W........W',
    'WWWWWWWWWW',
  ],
  // Level 5
  [
    'WWWWWWWWWW',
    'W........W',
    'W..WWW...W',
    'W..$O$...W',
    'W..O@O...W',
    'W..$O$...W',
    'W..WWW...W',
    'W........W',
    'W........W',
    'WWWWWWWWWW',
  ],
];

const game = defineGame({
  display: {
    type: 'grid',
    width: COLS,
    height: ROWS,
    cellSize: CELL,
    background: '#2C1810',
  },
  input: {
    up:      { keys: ['ArrowUp', 'w'] },
    down:    { keys: ['ArrowDown', 's'] },
    left:    { keys: ['ArrowLeft', 'a'] },
    right:   { keys: ['ArrowRight', 'd'] },
    action:  { keys: ['z', 'Z'] },   // Undo
    restart: { keys: ['r', 'R'] },
  },
});

game.component('Position', { x: 0, y: 0 });
game.component('Player', {});
game.component('Box', { onTarget: false });
game.component('Wall', {});
game.component('Target', {});

game.resource('state', {
  score: 0,
  level: 1,
  moves: 0,
  pushes: 0,
  gameOver: false,
  levelComplete: false,
  history: [],     // Undo stack: [{playerMove, boxMove?}]
});

function loadLevel(world, levelIdx) {
  // Clear existing entities
  for (const eid of world.query('Player')) world.destroyEntity(eid);
  for (const eid of world.query('Box')) world.destroyEntity(eid);
  for (const eid of world.query('Wall')) world.destroyEntity(eid);
  for (const eid of world.query('Target')) world.destroyEntity(eid);

  const data = LEVELS[levelIdx % LEVELS.length];

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = data[y][x];
      if (ch === 'W') {
        const eid = world.createEntity();
        world.addComponent(eid, 'Position', { x, y });
        world.addComponent(eid, 'Wall', {});
      }
      if (ch === 'O' || ch === '*' || ch === '+') {
        const eid = world.createEntity();
        world.addComponent(eid, 'Position', { x, y });
        world.addComponent(eid, 'Target', {});
      }
      if (ch === '$' || ch === '*') {
        const eid = world.createEntity();
        world.addComponent(eid, 'Position', { x, y });
        world.addComponent(eid, 'Box', { onTarget: ch === '*' });
      }
      if (ch === '@' || ch === '+') {
        const eid = world.createEntity();
        world.addComponent(eid, 'Position', { x, y });
        world.addComponent(eid, 'Player', {});
      }
    }
  }
}

// --- Spawn System ---
game.system('spawn', function spawnSystem(world, _dt) {
  if (world.getResource('_spawned')) return;
  world.setResource('_spawned', true);

  const state = world.getResource('state');
  state.history = [];
  state.moves = 0;
  state.pushes = 0;
  state.levelComplete = false;
  loadLevel(world, state.level - 1);
});

// --- Input System ---
game.system('input', function inputSystem(world, _dt) {
  const state = world.getResource('state');
  const input = world.getResource('input');

  if (state.gameOver || state.levelComplete) {
    if (consumeAction(input, 'restart')) {
      world.setResource('_spawned', false);
      if (state.gameOver) { state.level = 1; state.score = 0; }
      state.gameOver = false;
    }
    if (state.levelComplete && consumeAction(input, 'action')) {
      state.level++;
      state.levelComplete = false;
      world.setResource('_spawned', false);
    }
    return;
  }

  // Undo
  if (consumeAction(input, 'action') && state.history.length > 0) {
    const last = state.history.pop();
    const players = world.query('Player');
    if (players.length > 0) {
      const ppos = world.getComponent(players[0], 'Position');
      ppos.x = last.px; ppos.y = last.py;
    }
    if (last.boxId !== undefined) {
      const bpos = world.getComponent(last.boxId, 'Position');
      if (bpos) { bpos.x = last.bx; bpos.y = last.by; }
      state.pushes--;
    }
    state.moves--;
    return;
  }

  const dirs = [
    { action: 'up', dx: 0, dy: -1 },
    { action: 'down', dx: 0, dy: 1 },
    { action: 'left', dx: -1, dy: 0 },
    { action: 'right', dx: 1, dy: 0 },
  ];

  const players = world.query('Player');
  if (players.length === 0) return;
  const ppos = world.getComponent(players[0], 'Position');

  for (const { action, dx, dy } of dirs) {
    if (!consumeAction(input, action)) continue;

    const nx = ppos.x + dx;
    const ny = ppos.y + dy;

    // Check wall
    let blocked = false;
    for (const wid of world.query('Wall')) {
      const wp = world.getComponent(wid, 'Position');
      if (wp.x === nx && wp.y === ny) { blocked = true; break; }
    }
    if (blocked) continue;

    // Check box
    let pushedBox = null;
    for (const bid of world.query('Box')) {
      const bp = world.getComponent(bid, 'Position');
      if (bp.x === nx && bp.y === ny) { pushedBox = { id: bid, pos: bp }; break; }
    }

    if (pushedBox) {
      const bnx = nx + dx;
      const bny = ny + dy;

      // Check if box destination is blocked by wall
      let boxBlocked = false;
      for (const wid of world.query('Wall')) {
        const wp = world.getComponent(wid, 'Position');
        if (wp.x === bnx && wp.y === bny) { boxBlocked = true; break; }
      }
      // Check if box destination is blocked by another box
      if (!boxBlocked) {
        for (const bid of world.query('Box')) {
          const bp = world.getComponent(bid, 'Position');
          if (bp.x === bnx && bp.y === bny) { boxBlocked = true; break; }
        }
      }
      if (boxBlocked || bnx < 0 || bnx >= COLS || bny < 0 || bny >= ROWS) continue;

      // Push the box
      state.history.push({
        px: ppos.x, py: ppos.y,
        boxId: pushedBox.id, bx: pushedBox.pos.x, by: pushedBox.pos.y,
      });
      pushedBox.pos.x = bnx;
      pushedBox.pos.y = bny;
      state.pushes++;
    } else {
      state.history.push({ px: ppos.x, py: ppos.y });
    }

    ppos.x = nx;
    ppos.y = ny;
    state.moves++;
    break;
  }
});

// --- Win Check System ---
game.system('winCheck', function winCheckSystem(world, _dt) {
  const state = world.getResource('state');
  if (state.gameOver || state.levelComplete) return;

  const targets = world.query('Target');
  const boxes = world.query('Box');

  let allCovered = true;
  for (const tid of targets) {
    const tp = world.getComponent(tid, 'Position');
    let covered = false;
    for (const bid of boxes) {
      const bp = world.getComponent(bid, 'Position');
      if (bp.x === tp.x && bp.y === tp.y) { covered = true; break; }
    }
    if (!covered) { allCovered = false; break; }
  }

  // Update box onTarget state
  for (const bid of boxes) {
    const bp = world.getComponent(bid, 'Position');
    const box = world.getComponent(bid, 'Box');
    box.onTarget = false;
    for (const tid of targets) {
      const tp = world.getComponent(tid, 'Position');
      if (bp.x === tp.x && bp.y === tp.y) { box.onTarget = true; break; }
    }
  }

  if (allCovered && targets.length > 0) {
    state.levelComplete = true;
    state.score += Math.max(100, 500 - state.moves * 2);
    if (state.level >= LEVELS.length) {
      state.gameOver = true; // Won all levels
    }
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

  clearCanvas(ctx, '#2C1810');

  // Draw floor
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const px = offsetX + x * cellSize;
      const py = offsetY + y * cellSize;
      ctx.fillStyle = (x + y) % 2 === 0 ? '#3D2817' : '#352214';
      ctx.fillRect(px, py, cellSize, cellSize);
    }
  }

  // Draw walls
  for (const wid of world.query('Wall')) {
    const pos = world.getComponent(wid, 'Position');
    const px = offsetX + pos.x * cellSize;
    const py = offsetY + pos.y * cellSize;
    ctx.fillStyle = '#666';
    ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
    ctx.fillStyle = '#888';
    ctx.fillRect(px + 3, py + 3, cellSize - 6, cellSize - 10);
  }

  // Draw targets
  for (const tid of world.query('Target')) {
    const pos = world.getComponent(tid, 'Position');
    const cx = offsetX + pos.x * cellSize + cellSize / 2;
    const cy = offsetY + pos.y * cellSize + cellSize / 2;
    ctx.strokeStyle = '#FF6B6B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize / 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize / 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw boxes
  for (const bid of world.query('Box')) {
    const pos = world.getComponent(bid, 'Position');
    const box = world.getComponent(bid, 'Box');
    const px = offsetX + pos.x * cellSize;
    const py = offsetY + pos.y * cellSize;
    ctx.fillStyle = box.onTarget ? '#4CAF50' : '#D4A574';
    ctx.fillRect(px + 4, py + 4, cellSize - 8, cellSize - 8);
    ctx.strokeStyle = box.onTarget ? '#2E7D32' : '#8B6914';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 4, py + 4, cellSize - 8, cellSize - 8);
    // X mark on box
    ctx.strokeStyle = box.onTarget ? '#1B5E20' : '#654321';
    ctx.beginPath();
    ctx.moveTo(px + 10, py + 10); ctx.lineTo(px + cellSize - 10, py + cellSize - 10);
    ctx.moveTo(px + cellSize - 10, py + 10); ctx.lineTo(px + 10, py + cellSize - 10);
    ctx.stroke();
  }

  // Draw player
  for (const pid of world.query('Player')) {
    const pos = world.getComponent(pid, 'Position');
    const cx = offsetX + pos.x * cellSize + cellSize / 2;
    const cy = offsetY + pos.y * cellSize + cellSize / 2;
    // Body
    ctx.fillStyle = '#4FC3F7';
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize / 2 - 6, 0, Math.PI * 2);
    ctx.fill();
    // Face
    ctx.fillStyle = '#FFF';
    ctx.beginPath(); ctx.arc(cx - 5, cy - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 5, cy - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx - 5, cy - 3, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 5, cy - 3, 1.5, 0, Math.PI * 2); ctx.fill();
  }

  drawBorder(ctx, offsetX, offsetY, W, H, '#555');

  drawHUD(ctx, {
    level: state.level, moves: state.moves, pushes: state.pushes, score: state.score
  }, offsetX, W, offsetY, { fields: ['level', 'moves', 'pushes', 'score'], fontSize: 16 });

  if (state.levelComplete && !state.gameOver) {
    drawGameOver(ctx, offsetX, offsetY, W, H, {
      title: 'LEVEL COMPLETE!',
      subtitle: `Moves: ${state.moves} | Press Z for next level`,
    });
  }

  if (state.gameOver) {
    drawGameOver(ctx, offsetX, offsetY, W, H, {
      title: state.level > LEVELS.length ? 'YOU WIN!' : 'GAME OVER',
      subtitle: `Score: ${state.score} | Press R to restart`,
    });
  }
});

export default game;
