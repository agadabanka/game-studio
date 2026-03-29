/**
 * Pac-Man — Grid-based maze game using @engine SDK.
 *
 * Features:
 * - 21x21 maze with dots, power pellets, and walls
 * - 4 AI ghosts with different chase behaviors
 * - Power pellet mode (ghosts become vulnerable)
 * - Score tracking, lives, level progression
 * - Ghost AI using @engine/ai with composite evaluators
 *
 * Modules: @engine/core, @engine/grid, @engine/render, @engine/input, @engine/ai
 * Complexity: 7 systems, ~20KB
 */

import { defineGame } from '@engine/core';
import { consumeAction } from '@engine/input';
import { wrapPosition } from '@engine/grid';
import { clearCanvas, drawBorder, drawPieceCells, drawHUD, drawGameOver } from '@engine/render';
import { pickWeightedMove, compositeEvaluator } from '@engine/ai';

const COLS = 21;
const ROWS = 21;
const CELL = 28;

// Classic maze layout: 0=path, 1=wall, 2=dot, 3=power pellet, 4=ghost house
const MAZE_TEMPLATE = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
  [1,3,1,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,3,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,2,1,1,1,1,1,1,1,2,1,2,1,1,2,1],
  [1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1],
  [1,1,1,1,2,1,1,1,0,1,1,1,0,1,1,1,2,1,1,1,1],
  [0,0,0,1,2,1,0,0,0,0,0,0,0,0,0,1,2,1,0,0,0],
  [1,1,1,1,2,1,0,1,1,4,4,4,1,1,0,1,2,1,1,1,1],
  [0,0,0,0,2,0,0,1,4,4,4,4,4,1,0,0,2,0,0,0,0],
  [1,1,1,1,2,1,0,1,1,1,1,1,1,1,0,1,2,1,1,1,1],
  [0,0,0,1,2,1,0,0,0,0,0,0,0,0,0,1,2,1,0,0,0],
  [1,1,1,1,2,1,0,1,1,1,1,1,1,1,0,1,2,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,2,1],
  [1,3,2,1,2,2,2,2,2,2,0,2,2,2,2,2,2,1,2,3,1],
  [1,1,2,1,2,1,2,1,1,1,1,1,1,1,2,1,2,1,2,1,1],
  [1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1],
  [1,2,1,1,1,1,1,1,2,1,1,1,2,1,1,1,1,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

// Ghost personalities: each has a different chase strategy weight
const GHOST_CONFIGS = [
  { name: 'Blinky', color: '#FF0000', strategy: 'chase' },   // Direct chase
  { name: 'Pinky',  color: '#FFB8FF', strategy: 'ambush' },  // Aims ahead of player
  { name: 'Inky',   color: '#00FFFF', strategy: 'flank' },   // Flanking approach
  { name: 'Clyde',  color: '#FFB852', strategy: 'random' },  // Random when close
];

const DIRS = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };

const game = defineGame({
  display: {
    type: 'grid',
    width: COLS,
    height: ROWS,
    cellSize: CELL,
    background: '#000',
  },
  input: {
    up:      { keys: ['ArrowUp', 'w'] },
    down:    { keys: ['ArrowDown', 's'] },
    left:    { keys: ['ArrowLeft', 'a'] },
    right:   { keys: ['ArrowRight', 'd'] },
    restart: { keys: ['r', 'R'] },
  },
});

game.component('Position', { x: 0, y: 0 });
game.component('Direction', { dx: 0, dy: 0 });
game.component('Ghost', { name: '', color: '#F00', strategy: 'chase', frightened: false, eaten: false });
game.component('Player', { moving: false });

game.resource('state', {
  score: 0,
  lives: 3,
  level: 1,
  gameOver: false,
  dotsRemaining: 0,
  powerTimer: 0,
  ghostMoveTimer: 0,
  playerMoveTimer: 0,
});

game.resource('maze', null);

// --- Spawn System ---
game.system('spawn', function spawnSystem(world, _dt) {
  if (world.getResource('_spawned')) return;
  world.setResource('_spawned', true);

  // Deep copy maze
  const maze = MAZE_TEMPLATE.map(row => [...row]);
  world.setResource('maze', maze);

  // Count dots
  let dots = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (maze[y][x] === 2 || maze[y][x] === 3) dots++;
    }
  }
  const state = world.getResource('state');
  state.dotsRemaining = dots;

  // Spawn player at center bottom
  const player = world.createEntity();
  world.addComponent(player, 'Position', { x: 10, y: 15 });
  world.addComponent(player, 'Direction', { dx: 0, dy: 0 });
  world.addComponent(player, 'Player', { moving: false });

  // Spawn ghosts in ghost house
  const ghostPositions = [
    { x: 9, y: 9 }, { x: 10, y: 9 }, { x: 11, y: 9 }, { x: 10, y: 8 },
  ];
  GHOST_CONFIGS.forEach((cfg, i) => {
    const ghost = world.createEntity();
    world.addComponent(ghost, 'Position', { ...ghostPositions[i] });
    world.addComponent(ghost, 'Direction', { dx: 0, dy: 0 });
    world.addComponent(ghost, 'Ghost', { ...cfg, frightened: false, eaten: false });
  });
});

// --- Input System ---
game.system('input', function inputSystem(world, _dt) {
  const state = world.getResource('state');
  if (state.gameOver) {
    const input = world.getResource('input');
    if (consumeAction(input, 'restart')) {
      world.setResource('_spawned', false);
      state.score = 0; state.lives = 3; state.level = 1;
      state.gameOver = false; state.powerTimer = 0;
      for (const eid of world.query('Player')) world.destroyEntity(eid);
      for (const eid of world.query('Ghost')) world.destroyEntity(eid);
    }
    return;
  }

  const input = world.getResource('input');
  const maze = world.getResource('maze');
  const players = world.query('Player');
  if (players.length === 0) return;

  const pos = world.getComponent(players[0], 'Position');
  const dir = world.getComponent(players[0], 'Direction');

  for (const [action, d] of Object.entries(DIRS)) {
    if (consumeAction(input, action)) {
      const nx = pos.x + d.dx;
      const ny = pos.y + d.dy;
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && maze[ny][nx] !== 1) {
        dir.dx = d.dx;
        dir.dy = d.dy;
      }
    }
  }
});

// --- Player Movement System ---
game.system('playerMove', function playerMoveSystem(world, dt) {
  const state = world.getResource('state');
  if (state.gameOver) return;

  state.playerMoveTimer += dt;
  const moveInterval = 0.12;
  if (state.playerMoveTimer < moveInterval) return;
  state.playerMoveTimer = 0;

  const maze = world.getResource('maze');
  const players = world.query('Player');
  if (players.length === 0) return;

  const pos = world.getComponent(players[0], 'Position');
  const dir = world.getComponent(players[0], 'Direction');

  if (dir.dx === 0 && dir.dy === 0) return;

  let nx = pos.x + dir.dx;
  let ny = pos.y + dir.dy;

  // Tunnel wrap
  if (nx < 0) nx = COLS - 1;
  if (nx >= COLS) nx = 0;
  if (ny < 0) ny = ROWS - 1;
  if (ny >= ROWS) ny = 0;

  if (maze[ny][nx] === 1) return;

  pos.x = nx;
  pos.y = ny;

  // Eat dots
  if (maze[ny][nx] === 2) {
    maze[ny][nx] = 0;
    state.score += 10;
    state.dotsRemaining--;
  } else if (maze[ny][nx] === 3) {
    maze[ny][nx] = 0;
    state.score += 50;
    state.dotsRemaining--;
    state.powerTimer = 8; // 8 seconds of power
    for (const gid of world.query('Ghost')) {
      const ghost = world.getComponent(gid, 'Ghost');
      if (!ghost.eaten) ghost.frightened = true;
    }
  }

  // Level complete
  if (state.dotsRemaining <= 0) {
    state.level++;
    world.setResource('_spawned', false);
    for (const eid of world.query('Player')) world.destroyEntity(eid);
    for (const eid of world.query('Ghost')) world.destroyEntity(eid);
  }
});

// --- Ghost AI System ---
game.system('ghostAI', function ghostAISystem(world, dt) {
  const state = world.getResource('state');
  if (state.gameOver) return;

  // Power timer countdown
  if (state.powerTimer > 0) {
    state.powerTimer -= dt;
    if (state.powerTimer <= 0) {
      state.powerTimer = 0;
      for (const gid of world.query('Ghost')) {
        const ghost = world.getComponent(gid, 'Ghost');
        ghost.frightened = false;
      }
    }
  }

  state.ghostMoveTimer += dt;
  const ghostSpeed = Math.max(0.15, 0.3 - state.level * 0.02);
  if (state.ghostMoveTimer < ghostSpeed) return;
  state.ghostMoveTimer = 0;

  const maze = world.getResource('maze');
  const players = world.query('Player');
  if (players.length === 0) return;
  const playerPos = world.getComponent(players[0], 'Position');
  const playerDir = world.getComponent(players[0], 'Direction');

  for (const gid of world.query('Ghost')) {
    const gpos = world.getComponent(gid, 'Position');
    const ghost = world.getComponent(gid, 'Ghost');

    if (ghost.eaten) continue;

    // Get valid moves
    const moves = [];
    for (const [, d] of Object.entries(DIRS)) {
      let nx = gpos.x + d.dx;
      let ny = gpos.y + d.dy;
      if (nx < 0) nx = COLS - 1;
      if (nx >= COLS) nx = 0;
      if (ny >= 0 && ny < ROWS && maze[ny][nx] !== 1) {
        moves.push({ dx: d.dx, dy: d.dy, x: nx, y: ny });
      }
    }

    if (moves.length === 0) continue;

    let chosen;
    if (ghost.frightened) {
      // Run away from player
      chosen = pickWeightedMove(moves, (move) => {
        const dist = Math.abs(move.x - playerPos.x) + Math.abs(move.y - playerPos.y);
        return dist; // Higher distance = better when frightened
      });
    } else {
      // Chase based on personality
      const evaluator = compositeEvaluator([
        { weight: ghost.strategy === 'chase' ? 3 : 1, fn: (move) => {
          const dist = Math.abs(move.x - playerPos.x) + Math.abs(move.y - playerPos.y);
          return -dist; // Closer = better
        }},
        { weight: ghost.strategy === 'ambush' ? 3 : 0.5, fn: (move) => {
          // Aim 4 cells ahead of player
          const targetX = playerPos.x + playerDir.dx * 4;
          const targetY = playerPos.y + playerDir.dy * 4;
          return -(Math.abs(move.x - targetX) + Math.abs(move.y - targetY));
        }},
        { weight: ghost.strategy === 'random' ? 2 : 0, fn: () => Math.random() * 10 },
      ]);
      chosen = pickWeightedMove(moves, evaluator);
    }

    if (chosen) {
      gpos.x = chosen.x;
      gpos.y = chosen.y;
    }
  }
});

// --- Collision System ---
game.system('collision', function collisionSystem(world, _dt) {
  const state = world.getResource('state');
  if (state.gameOver) return;

  const players = world.query('Player');
  if (players.length === 0) return;
  const ppos = world.getComponent(players[0], 'Position');

  for (const gid of world.query('Ghost')) {
    const gpos = world.getComponent(gid, 'Position');
    const ghost = world.getComponent(gid, 'Ghost');

    if (ghost.eaten) continue;
    if (gpos.x !== ppos.x || gpos.y !== ppos.y) continue;

    if (ghost.frightened) {
      // Eat ghost
      ghost.eaten = true;
      state.score += 200;
    } else {
      // Ghost kills player
      state.lives--;
      if (state.lives <= 0) {
        state.gameOver = true;
      } else {
        // Reset positions
        ppos.x = 10; ppos.y = 15;
        const pdir = world.getComponent(players[0], 'Direction');
        pdir.dx = 0; pdir.dy = 0;
      }
    }
  }
});

// --- Render System ---
game.system('render', function renderSystem(world, _dt) {
  const renderer = world.getResource('renderer');
  if (!renderer) return;
  const { ctx, cellSize, offsetX, offsetY } = renderer;
  const state = world.getResource('state');
  const maze = world.getResource('maze');
  const W = COLS * cellSize;
  const H = ROWS * cellSize;

  clearCanvas(ctx, '#000');
  drawBorder(ctx, offsetX, offsetY, W, H, '#2121DE');

  if (!maze) return;

  // Draw maze
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const px = offsetX + x * cellSize;
      const py = offsetY + y * cellSize;
      const cell = maze[y][x];

      if (cell === 1) {
        ctx.fillStyle = '#2121DE';
        ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
      } else if (cell === 2) {
        ctx.fillStyle = '#FFB8AE';
        ctx.beginPath();
        ctx.arc(px + cellSize / 2, py + cellSize / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (cell === 3) {
        ctx.fillStyle = '#FFB8AE';
        ctx.beginPath();
        ctx.arc(px + cellSize / 2, py + cellSize / 2, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Draw player (Pac-Man)
  for (const pid of world.query('Player')) {
    const pos = world.getComponent(pid, 'Position');
    const dir = world.getComponent(pid, 'Direction');
    const cx = offsetX + pos.x * cellSize + cellSize / 2;
    const cy = offsetY + pos.y * cellSize + cellSize / 2;
    const r = cellSize / 2 - 2;

    // Calculate mouth angle based on direction
    let startAngle = 0.25 * Math.PI;
    let endAngle = 1.75 * Math.PI;
    if (dir.dx === 1) { startAngle = 0.25 * Math.PI; endAngle = 1.75 * Math.PI; }
    else if (dir.dx === -1) { startAngle = 1.25 * Math.PI; endAngle = 0.75 * Math.PI; }
    else if (dir.dy === -1) { startAngle = 1.75 * Math.PI; endAngle = 1.25 * Math.PI; }
    else if (dir.dy === 1) { startAngle = 0.75 * Math.PI; endAngle = 0.25 * Math.PI; }

    ctx.fillStyle = '#FFFF00';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();
  }

  // Draw ghosts
  for (const gid of world.query('Ghost')) {
    const pos = world.getComponent(gid, 'Position');
    const ghost = world.getComponent(gid, 'Ghost');
    if (ghost.eaten) continue;

    const cx = offsetX + pos.x * cellSize + cellSize / 2;
    const cy = offsetY + pos.y * cellSize + cellSize / 2;
    const r = cellSize / 2 - 2;

    ctx.fillStyle = ghost.frightened ? '#2121DE' : ghost.color;
    // Ghost body (rounded top, wavy bottom)
    ctx.beginPath();
    ctx.arc(cx, cy - 2, r, Math.PI, 0);
    ctx.lineTo(cx + r, cy + r);
    // Wavy bottom
    for (let i = 0; i < 3; i++) {
      const wx = cx + r - (i + 1) * (2 * r / 3);
      ctx.quadraticCurveTo(wx + r / 3, cy + r - 5, wx, cy + r);
    }
    ctx.closePath();
    ctx.fill();

    // Eyes
    if (!ghost.frightened) {
      ctx.fillStyle = '#FFF';
      ctx.beginPath(); ctx.arc(cx - 4, cy - 4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 4, cy - 4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#00F';
      ctx.beginPath(); ctx.arc(cx - 4, cy - 4, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 4, cy - 4, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawHUD(ctx, { score: state.score, lives: state.lives, level: state.level },
    offsetX, W, offsetY, { fields: ['score', 'lives', 'level'], fontSize: 16 });

  if (state.gameOver) {
    drawGameOver(ctx, offsetX, offsetY, W, H, {
      title: 'GAME OVER',
      subtitle: `Score: ${state.score} | Press R to restart`,
    });
  }
});

export default game;
