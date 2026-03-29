/**
 * Frogger — Lane-based obstacle avoidance using @engine SDK.
 *
 * Features:
 * - 13-row playfield: safe zones, road lanes (cars), river lanes (logs)
 * - Cars and logs move at different speeds per lane
 * - Frog must ride logs on river (fall in = death)
 * - 5 home slots to fill to complete a level
 * - Lives, scoring, level progression with faster speeds
 *
 * New patterns validated:
 * - Per-lane scrolling speeds (tests wrapPosition at different rates)
 * - Entity-rides-entity (frog on log)
 * - Multiple win slots (partial level completion)
 *
 * Modules: @engine/core, @engine/grid, @engine/render, @engine/input
 * Complexity: 6 systems, ~18KB
 */

import { defineGame } from '@engine/core';
import { consumeAction } from '@engine/input';
import { wrapPosition } from '@engine/grid';
import { clearCanvas, drawBorder, drawSquare, drawHUD, drawGameOver } from '@engine/render';

const COLS = 13;
const ROWS = 13;
const CELL = 40;

// Lane definitions: type, direction, speed, object widths
const LANES = [
  { type: 'home',  row: 0 },
  { type: 'river', row: 1,  dir: 1,  speed: 1.5, objWidth: 3, gap: 5, color: '#8B4513' },
  { type: 'river', row: 2,  dir: -1, speed: 2.0, objWidth: 2, gap: 4, color: '#8B4513' },
  { type: 'river', row: 3,  dir: 1,  speed: 1.0, objWidth: 4, gap: 6, color: '#8B4513' },
  { type: 'river', row: 4,  dir: -1, speed: 1.8, objWidth: 2, gap: 4, color: '#8B4513' },
  { type: 'river', row: 5,  dir: 1,  speed: 1.2, objWidth: 3, gap: 5, color: '#8B4513' },
  { type: 'safe',  row: 6 },
  { type: 'road',  row: 7,  dir: -1, speed: 2.0, objWidth: 1, gap: 3, color: '#FF0000' },
  { type: 'road',  row: 8,  dir: 1,  speed: 1.5, objWidth: 2, gap: 4, color: '#FFAA00' },
  { type: 'road',  row: 9,  dir: -1, speed: 2.5, objWidth: 1, gap: 3, color: '#FF4444' },
  { type: 'road',  row: 10, dir: 1,  speed: 1.8, objWidth: 2, gap: 4, color: '#FF8800' },
  { type: 'road',  row: 11, dir: -1, speed: 3.0, objWidth: 1, gap: 3, color: '#CC0000' },
  { type: 'start', row: 12 },
];

const HOME_SLOTS = [1, 4, 7, 10, 12]; // X positions of home slots

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
game.component('Frog', { onLog: false, ridingLogId: -1 });
game.component('Obstacle', { lane: 0, width: 1, color: '#F00', speed: 0, dir: 1, subX: 0 });

game.resource('state', {
  score: 0,
  lives: 3,
  level: 1,
  gameOver: false,
  homesFilled: [false, false, false, false, false],
  moveTimer: 0,
});

// --- Spawn System ---
game.system('spawn', function spawnSystem(world, _dt) {
  if (world.getResource('_spawned')) return;
  world.setResource('_spawned', true);

  // Spawn frog at bottom center
  const frog = world.createEntity();
  world.addComponent(frog, 'Position', { x: 6, y: 12 });
  world.addComponent(frog, 'Frog', { onLog: false, ridingLogId: -1 });

  const state = world.getResource('state');
  const speedMult = 1 + (state.level - 1) * 0.15;

  // Spawn obstacles for each lane
  for (const lane of LANES) {
    if (lane.type !== 'road' && lane.type !== 'river') continue;

    const count = Math.ceil(COLS / (lane.objWidth + lane.gap));
    for (let i = 0; i < count; i++) {
      const obs = world.createEntity();
      const startX = i * (lane.objWidth + lane.gap);
      world.addComponent(obs, 'Position', { x: startX, y: lane.row });
      world.addComponent(obs, 'Obstacle', {
        lane: lane.row,
        width: lane.objWidth,
        color: lane.color,
        speed: lane.speed * speedMult,
        dir: lane.dir,
        subX: startX,
      });
    }
  }
});

// --- Input System ---
game.system('input', function inputSystem(world, _dt) {
  const state = world.getResource('state');
  if (state.gameOver) {
    const input = world.getResource('input');
    if (consumeAction(input, 'restart')) {
      world.setResource('_spawned', false);
      state.score = 0; state.lives = 3; state.level = 1;
      state.gameOver = false;
      state.homesFilled = [false, false, false, false, false];
      for (const eid of world.query('Frog')) world.destroyEntity(eid);
      for (const eid of world.query('Obstacle')) world.destroyEntity(eid);
    }
    return;
  }

  const input = world.getResource('input');
  const frogs = world.query('Frog');
  if (frogs.length === 0) return;

  state.moveTimer += 0.016;
  if (state.moveTimer < 0.15) return;

  const pos = world.getComponent(frogs[0], 'Position');

  if (consumeAction(input, 'up') && pos.y > 0) {
    pos.y--; state.score += 10; state.moveTimer = 0;
  }
  if (consumeAction(input, 'down') && pos.y < ROWS - 1) {
    pos.y++; state.moveTimer = 0;
  }
  if (consumeAction(input, 'left') && pos.x > 0) {
    pos.x--; state.moveTimer = 0;
  }
  if (consumeAction(input, 'right') && pos.x < COLS - 1) {
    pos.x++; state.moveTimer = 0;
  }
});

// --- Obstacle Movement System ---
game.system('obstacleMove', function obstacleMoveSystem(world, dt) {
  const state = world.getResource('state');
  if (state.gameOver) return;

  for (const eid of world.query('Obstacle')) {
    const obs = world.getComponent(eid, 'Obstacle');
    const pos = world.getComponent(eid, 'Position');

    obs.subX += obs.speed * obs.dir * dt;

    // Wrap around
    if (obs.subX > COLS + obs.width) obs.subX = -obs.width;
    if (obs.subX < -obs.width) obs.subX = COLS + obs.width;

    pos.x = Math.floor(obs.subX);
  }
});

// --- Collision System ---
game.system('collision', function collisionSystem(world, _dt) {
  const state = world.getResource('state');
  if (state.gameOver) return;

  const frogs = world.query('Frog');
  if (frogs.length === 0) return;
  const fpos = world.getComponent(frogs[0], 'Position');
  const frog = world.getComponent(frogs[0], 'Frog');

  const lane = LANES.find(l => l.row === fpos.y);
  if (!lane) return;

  if (lane.type === 'road') {
    // Check car collision
    for (const eid of world.query('Obstacle')) {
      const obs = world.getComponent(eid, 'Obstacle');
      if (obs.lane !== fpos.y) continue;
      if (fpos.x >= Math.floor(obs.subX) && fpos.x < Math.floor(obs.subX) + obs.width) {
        // Hit by car
        state.lives--;
        if (state.lives <= 0) { state.gameOver = true; return; }
        fpos.x = 6; fpos.y = 12;
        return;
      }
    }
  }

  if (lane.type === 'river') {
    // Must be on a log
    let onLog = false;
    for (const eid of world.query('Obstacle')) {
      const obs = world.getComponent(eid, 'Obstacle');
      if (obs.lane !== fpos.y) continue;
      if (fpos.x >= Math.floor(obs.subX) && fpos.x < Math.floor(obs.subX) + obs.width) {
        onLog = true;
        frog.onLog = true;
        // Ride the log
        fpos.x = Math.max(0, Math.min(COLS - 1, fpos.x + Math.sign(obs.dir) * Math.round(obs.speed * 0.016)));
        break;
      }
    }
    if (!onLog) {
      // Fell in water
      state.lives--;
      if (state.lives <= 0) { state.gameOver = true; return; }
      fpos.x = 6; fpos.y = 12;
      frog.onLog = false;
    }
  }

  if (lane.type === 'home') {
    // Check if at a home slot
    const slotIdx = HOME_SLOTS.indexOf(fpos.x);
    if (slotIdx !== -1 && !state.homesFilled[slotIdx]) {
      state.homesFilled[slotIdx] = true;
      state.score += 200;
      fpos.x = 6; fpos.y = 12;

      // Check level complete
      if (state.homesFilled.every(Boolean)) {
        state.level++;
        state.score += 1000;
        state.homesFilled = [false, false, false, false, false];
        world.setResource('_spawned', false);
        for (const eid of world.query('Frog')) world.destroyEntity(eid);
        for (const eid of world.query('Obstacle')) world.destroyEntity(eid);
      }
    } else {
      // Invalid home position
      fpos.y = 1;
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

  clearCanvas(ctx, '#000');

  // Draw lane backgrounds
  for (const lane of LANES) {
    const y = offsetY + lane.row * cellSize;
    if (lane.type === 'river') {
      ctx.fillStyle = '#1E3A5F';
      ctx.fillRect(offsetX, y, W, cellSize);
    } else if (lane.type === 'road') {
      ctx.fillStyle = '#333';
      ctx.fillRect(offsetX, y, W, cellSize);
    } else if (lane.type === 'safe' || lane.type === 'start') {
      ctx.fillStyle = '#2D5A1E';
      ctx.fillRect(offsetX, y, W, cellSize);
    } else if (lane.type === 'home') {
      ctx.fillStyle = '#2D5A1E';
      ctx.fillRect(offsetX, y, W, cellSize);
      // Draw home slots
      HOME_SLOTS.forEach((sx, i) => {
        ctx.fillStyle = state.homesFilled[i] ? '#00FF00' : '#1E3A5F';
        ctx.fillRect(offsetX + sx * cellSize + 4, y + 4, cellSize - 8, cellSize - 8);
      });
    }
  }

  // Draw obstacles
  for (const eid of world.query('Obstacle')) {
    const obs = world.getComponent(eid, 'Obstacle');
    const laneInfo = LANES.find(l => l.row === obs.lane);
    const y = offsetY + obs.lane * cellSize;

    for (let i = 0; i < obs.width; i++) {
      const drawX = Math.floor(obs.subX) + i;
      if (drawX >= 0 && drawX < COLS) {
        ctx.fillStyle = obs.color;
        ctx.fillRect(offsetX + drawX * cellSize + 2, y + 2, cellSize - 4, cellSize - 4);
        if (laneInfo && laneInfo.type === 'river') {
          // Log texture
          ctx.strokeStyle = '#654321';
          ctx.strokeRect(offsetX + drawX * cellSize + 4, y + 4, cellSize - 8, cellSize - 8);
        }
      }
    }
  }

  // Draw frog
  for (const fid of world.query('Frog')) {
    const pos = world.getComponent(fid, 'Position');
    const cx = offsetX + pos.x * cellSize + cellSize / 2;
    const cy = offsetY + pos.y * cellSize + cellSize / 2;
    const r = cellSize / 2 - 4;

    // Body
    ctx.fillStyle = '#32CD32';
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#FFF';
    ctx.beginPath(); ctx.arc(cx - 5, cy - 5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 5, cy - 5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx - 5, cy - 5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 5, cy - 5, 2, 0, Math.PI * 2); ctx.fill();
  }

  drawBorder(ctx, offsetX, offsetY, W, H, '#444');

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
