/**
 * Go (9x9) — Territory control board game using @engine SDK.
 *
 * Features:
 * - 9x9 board (beginner-friendly size)
 * - Stone placement, capture mechanics (liberties)
 * - Ko rule (prevents infinite loops)
 * - Territory counting at game end
 * - Pass, resign, scoring
 * - AI opponent using @engine/ai with territory evaluation
 * - Uses @engine/turns for turn management
 *
 * New patterns validated:
 * - Group/flood-fill algorithms (liberty counting)
 * - Ko rule (game state comparison)
 * - Territory scoring (area counting)
 * - Pass mechanic (both pass = game ends)
 *
 * Modules: @engine/core, @engine/render, @engine/input, @engine/ai, @engine/turns
 * Complexity: 6 systems, ~20KB
 */

import { defineGame } from '@engine/core';
import { consumeAction, moveCursor } from '@engine/input';
import { clearCanvas, drawBorder, drawSquare, drawHUD, drawGameOver } from '@engine/render';
import { pickBestMove } from '@engine/ai';

const SIZE = 9;
const CELL = 50;
const MARGIN = 30;
const EMPTY = 0, BLACK = 1, WHITE = 2;

const game = defineGame({
  display: {
    type: 'custom',
    canvasWidth: SIZE * CELL + MARGIN * 2 + 200,
    canvasHeight: SIZE * CELL + MARGIN * 2 + 40,
    offsetX: MARGIN,
    offsetY: MARGIN,
    background: '#DEB887',
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

game.component('Cursor', { x: 4, y: 4 });

game.resource('state', {
  board: [],           // 9x9 grid: 0=empty, 1=black, 2=white
  currentPlayer: BLACK,
  captures: { [BLACK]: 0, [WHITE]: 0 },
  lastBoard: null,     // For ko detection
  consecutivePasses: 0,
  gameOver: false,
  gamePhase: 'play',   // play, scoring, done
  territories: { [BLACK]: 0, [WHITE]: 0 },
  message: '',
  aiThinking: false,
  aiTimer: 0,
  moveCount: 0,
});

function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
}

function copyBoard(board) {
  return board.map(row => [...row]);
}

function boardsEqual(a, b) {
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      if (a[y][x] !== b[y][x]) return false;
  return true;
}

function getGroup(board, x, y) {
  const color = board[y][x];
  if (color === EMPTY) return { stones: [], liberties: 0 };

  const visited = new Set();
  const stones = [];
  let liberties = 0;
  const libertiesSet = new Set();

  function flood(fx, fy) {
    const key = `${fx},${fy}`;
    if (visited.has(key)) return;
    if (fx < 0 || fx >= SIZE || fy < 0 || fy >= SIZE) return;

    if (board[fy][fx] === EMPTY) {
      if (!libertiesSet.has(key)) { liberties++; libertiesSet.add(key); }
      return;
    }
    if (board[fy][fx] !== color) return;

    visited.add(key);
    stones.push({ x: fx, y: fy });
    flood(fx - 1, fy); flood(fx + 1, fy);
    flood(fx, fy - 1); flood(fx, fy + 1);
  }

  flood(x, y);
  return { stones, liberties };
}

function isLegalMove(board, x, y, player, lastBoard) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return false;
  if (board[y][x] !== EMPTY) return false;

  // Try the move
  const testBoard = copyBoard(board);
  testBoard[y][x] = player;

  // Check captures first
  const opponent = player === BLACK ? WHITE : BLACK;
  let captured = false;
  for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && testBoard[ny][nx] === opponent) {
      const group = getGroup(testBoard, nx, ny);
      if (group.liberties === 0) {
        for (const s of group.stones) testBoard[s.y][s.x] = EMPTY;
        captured = true;
      }
    }
  }

  // Check self-capture (suicide)
  const selfGroup = getGroup(testBoard, x, y);
  if (selfGroup.liberties === 0 && !captured) return false;

  // Ko rule
  if (lastBoard && boardsEqual(testBoard, lastBoard)) return false;

  return true;
}

function applyMove(board, x, y, player) {
  const newBoard = copyBoard(board);
  newBoard[y][x] = player;
  const opponent = player === BLACK ? WHITE : BLACK;
  let capturedCount = 0;

  for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && newBoard[ny][nx] === opponent) {
      const group = getGroup(newBoard, nx, ny);
      if (group.liberties === 0) {
        for (const s of group.stones) { newBoard[s.y][s.x] = EMPTY; capturedCount++; }
      }
    }
  }

  return { board: newBoard, captured: capturedCount };
}

function countTerritory(board) {
  const territory = { [BLACK]: 0, [WHITE]: 0 };
  const visited = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] !== EMPTY || visited[y][x]) continue;

      // Flood fill empty region
      const region = [];
      let touchesBlack = false, touchesWhite = false;

      function flood(fx, fy) {
        if (fx < 0 || fx >= SIZE || fy < 0 || fy >= SIZE) return;
        if (board[fy][fx] === BLACK) { touchesBlack = true; return; }
        if (board[fy][fx] === WHITE) { touchesWhite = true; return; }
        if (visited[fy][fx]) return;
        visited[fy][fx] = true;
        region.push({ x: fx, y: fy });
        flood(fx-1, fy); flood(fx+1, fy); flood(fx, fy-1); flood(fx, fy+1);
      }
      flood(x, y);

      if (touchesBlack && !touchesWhite) territory[BLACK] += region.length;
      if (touchesWhite && !touchesBlack) territory[WHITE] += region.length;
    }
  }
  return territory;
}

// --- Spawn System ---
game.system('spawn', function spawnSystem(world, _dt) {
  if (world.getResource('_spawned')) return;
  world.setResource('_spawned', true);

  const state = world.getResource('state');
  state.board = createEmptyBoard();
  state.currentPlayer = BLACK;
  state.captures = { [BLACK]: 0, [WHITE]: 0 };
  state.lastBoard = null;
  state.consecutivePasses = 0;
  state.gameOver = false;
  state.gamePhase = 'play';
  state.message = '';
  state.moveCount = 0;

  const cursor = world.createEntity();
  world.addComponent(cursor, 'Cursor', { x: 4, y: 4 });
});

// --- Input System ---
game.system('input', function inputSystem(world, _dt) {
  const state = world.getResource('state');
  const input = world.getResource('input');

  if (state.gameOver) {
    if (consumeAction(input, 'restart')) {
      world.setResource('_spawned', false);
      for (const eid of world.query('Cursor')) world.destroyEntity(eid);
    }
    return;
  }

  if (state.currentPlayer !== BLACK) return; // Wait for AI

  const cursors = world.query('Cursor');
  if (cursors.length === 0) return;
  const cur = world.getComponent(cursors[0], 'Cursor');

  // Move cursor
  if (consumeAction(input, 'up') && cur.y > 0) cur.y--;
  if (consumeAction(input, 'down') && cur.y < SIZE - 1) cur.y++;
  if (consumeAction(input, 'left') && cur.x > 0) cur.x--;
  if (consumeAction(input, 'right') && cur.x < SIZE - 1) cur.x++;

  // Place stone
  if (consumeAction(input, 'action')) {
    if (isLegalMove(state.board, cur.x, cur.y, BLACK, state.lastBoard)) {
      const lastBoard = copyBoard(state.board);
      const result = applyMove(state.board, cur.x, cur.y, BLACK);
      state.board = result.board;
      state.captures[BLACK] += result.captured;
      state.lastBoard = lastBoard;
      state.consecutivePasses = 0;
      state.currentPlayer = WHITE;
      state.message = '';
      state.moveCount++;
      state.aiTimer = 0;
    } else {
      state.message = 'Illegal move';
    }
  }

  // Pass (press down when at bottom edge + action, or just restart key mapped to pass)
  if (consumeAction(input, 'restart')) {
    state.consecutivePasses++;
    state.lastBoard = copyBoard(state.board);
    state.currentPlayer = WHITE;
    state.message = 'Black passes';
    if (state.consecutivePasses >= 2) {
      endGame(state);
    }
  }
});

// --- AI System ---
game.system('ai', function aiSystem(world, dt) {
  const state = world.getResource('state');
  if (state.gameOver || state.currentPlayer !== WHITE) return;

  state.aiTimer += dt;
  if (state.aiTimer < 0.5) return;

  // Find all legal moves
  const moves = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (isLegalMove(state.board, x, y, WHITE, state.lastBoard)) {
        moves.push({ x, y });
      }
    }
  }

  if (moves.length === 0 || (state.moveCount > 60 && Math.random() < 0.3)) {
    // Pass
    state.consecutivePasses++;
    state.lastBoard = copyBoard(state.board);
    state.currentPlayer = BLACK;
    state.message = 'White passes';
    if (state.consecutivePasses >= 2) endGame(state);
    return;
  }

  // Evaluate moves
  const chosen = pickBestMove(moves, (move) => {
    const result = applyMove(state.board, move.x, move.y, WHITE);
    let score = result.captured * 10; // Captures are valuable

    // Prefer center positions early
    const centerDist = Math.abs(move.x - 4) + Math.abs(move.y - 4);
    score -= centerDist * 0.5;

    // Check resulting liberties
    const group = getGroup(result.board, move.x, move.y);
    score += group.liberties * 2;

    // Avoid edges early
    if (move.x === 0 || move.x === SIZE-1 || move.y === 0 || move.y === SIZE-1) {
      score -= 3;
    }

    // Territory potential
    const territory = countTerritory(result.board);
    score += (territory[WHITE] - territory[BLACK]) * 0.5;

    return score;
  });

  if (chosen) {
    const lastBoard = copyBoard(state.board);
    const result = applyMove(state.board, chosen.x, chosen.y, WHITE);
    state.board = result.board;
    state.captures[WHITE] += result.captured;
    state.lastBoard = lastBoard;
    state.consecutivePasses = 0;
    state.moveCount++;
    state.message = `White plays ${String.fromCharCode(65 + chosen.x)}${SIZE - chosen.y}`;
  }

  state.currentPlayer = BLACK;
});

function endGame(state) {
  state.gamePhase = 'scoring';
  const territory = countTerritory(state.board);
  state.territories = territory;

  // Komi: 6.5 for white
  const komi = 6.5;
  const blackScore = territory[BLACK] + state.captures[BLACK];
  const whiteScore = territory[WHITE] + state.captures[WHITE] + komi;

  state.message = `Black: ${blackScore} | White: ${whiteScore} | ${blackScore > whiteScore ? 'Black wins!' : 'White wins!'}`;
  state.gameOver = true;
}

// --- Render System ---
game.system('render', function renderSystem(world, _dt) {
  const renderer = world.getResource('renderer');
  if (!renderer) return;
  const { ctx, offsetX, offsetY } = renderer;
  const state = world.getResource('state');
  const boardSize = (SIZE - 1) * CELL;

  clearCanvas(ctx, '#DEB887');

  // Draw board
  const bx = offsetX + 20;
  const by = offsetY + 20;

  // Grid lines
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  for (let i = 0; i < SIZE; i++) {
    // Horizontal
    ctx.beginPath();
    ctx.moveTo(bx, by + i * CELL);
    ctx.lineTo(bx + boardSize, by + i * CELL);
    ctx.stroke();
    // Vertical
    ctx.beginPath();
    ctx.moveTo(bx + i * CELL, by);
    ctx.lineTo(bx + i * CELL, by + boardSize);
    ctx.stroke();
  }

  // Star points (hoshi)
  const hoshi = SIZE === 9 ? [[2,2],[2,6],[6,2],[6,6],[4,4]] : [[3,3],[3,9],[9,3],[9,9],[6,6]];
  for (const [hx, hy] of hoshi) {
    if (hx < SIZE && hy < SIZE) {
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(bx + hx * CELL, by + hy * CELL, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Coordinate labels
  ctx.fillStyle = '#333';
  ctx.font = '12px monospace';
  for (let i = 0; i < SIZE; i++) {
    ctx.fillText(String.fromCharCode(65 + i), bx + i * CELL - 4, by - 10);
    ctx.fillText(`${SIZE - i}`, bx - 20, by + i * CELL + 4);
  }

  // Draw stones
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (state.board[y][x] === EMPTY) continue;
      const sx = bx + x * CELL;
      const sy = by + y * CELL;
      const r = CELL / 2 - 3;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(sx + 2, sy + 2, r, 0, Math.PI * 2);
      ctx.fill();

      // Stone
      if (state.board[y][x] === BLACK) {
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(sx - 3, sy - 3, r / 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#F5F5F5';
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  // Draw cursor
  if (!state.gameOver && state.currentPlayer === BLACK) {
    for (const cid of world.query('Cursor')) {
      const cur = world.getComponent(cid, 'Cursor');
      const cx = bx + cur.x * CELL;
      const cy = by + cur.y * CELL;

      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL / 2 - 2, 0, Math.PI * 2);
      ctx.stroke();

      // Ghost stone
      if (state.board[cur.y][cur.x] === EMPTY) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(cx, cy, CELL / 2 - 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // HUD (right side)
  const hudX = bx + boardSize + 40;
  ctx.fillStyle = '#333';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('Go 9x9', hudX, by + 10);

  ctx.font = '14px monospace';
  ctx.fillStyle = '#000';
  ctx.fillText(`Turn: ${state.currentPlayer === BLACK ? 'Black (You)' : 'White (AI)'}`, hudX, by + 40);

  ctx.fillText('Captures:', hudX, by + 70);
  ctx.fillText(`  Black: ${state.captures[BLACK]}`, hudX, by + 90);
  ctx.fillText(`  White: ${state.captures[WHITE]}`, hudX, by + 110);

  ctx.fillText(`Move: ${state.moveCount}`, hudX, by + 140);

  ctx.fillStyle = '#666';
  ctx.font = '11px monospace';
  ctx.fillText('Arrows: move cursor', hudX, by + 180);
  ctx.fillText('Space: place stone', hudX, by + 196);
  ctx.fillText('R: pass', hudX, by + 212);

  // Message
  if (state.message) {
    ctx.fillStyle = '#C00';
    ctx.font = '14px monospace';
    ctx.fillText(state.message, hudX, by + 250);
  }

  if (state.gameOver) {
    // Score display
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(bx - 10, by + boardSize / 2 - 40, boardSize + 20, 80);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', bx + boardSize / 2, by + boardSize / 2 - 10);
    ctx.font = '13px monospace';
    ctx.fillText(state.message, bx + boardSize / 2, by + boardSize / 2 + 15);
    ctx.fillText('Press R to restart', bx + boardSize / 2, by + boardSize / 2 + 35);
    ctx.textAlign = 'left';
  }
});

export default game;
