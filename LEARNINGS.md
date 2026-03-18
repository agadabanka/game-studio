# Learnings: Where the Generalization Fails

This document captures concrete findings from battle-testing the @engine SDK
across 4 games (Chess, Tetris, Snake, Ludo). Each section describes a gap,
what game exposed it, how we worked around it, and what the fix should be.

Updated: 2026-03-18

---

## 1. Canvas Sizing Assumes Grid Layout

**Exposed by:** Ludo (first non-grid game)

**Problem:** `core.js` hardcoded canvas size as `width * cellSize + 180` (grid width + HUD).
Ludo's board is a 15x15 cross shape that needs custom pixel dimensions.

**Workaround:** Added `canvasWidth`, `canvasHeight`, `offsetX`, `offsetY` to display config:
```javascript
display: {
  type: 'custom',
  canvasWidth: 720,
  canvasHeight: 560,
  offsetX: 55,
  offsetY: 30,
}
```

**Status:** Fixed in core.js. Falls back to grid calculation when custom values absent.

**Recommendation:** Display config should support: `grid` (auto-calculated), `custom` (explicit),
and potentially `responsive` (fills container). The 180px HUD width assumption is fragile —
should be configurable or auto-calculated from HUD content.

---

## 2. No AI/Decision-Making Module

**Exposed by:** Ludo (first game with AI opponents)

**Problem:** The SDK had no helpers for AI decision-making. Chess, Tetris, and Snake are
all human-controlled. Ludo requires 4 AI players making strategic decisions each turn.

**Solution:** Created `@engine/ai.js` with:
- `pickBestMove(moves, evaluator)` — deterministic best-score selection
- `pickWeightedMove(moves, evaluator)` — probabilistic (personality-driven)
- `pickRandomMove(moves)` — chaotic wildcard
- `compositeEvaluator(evaluators)` — combine multiple scoring strategies with weights

**Lesson learned:** The AI module is game-agnostic — it operates on abstract "moves" and
"evaluators" without knowing what they represent. This is the right abstraction level.
Any game that defines `getValidMoves()` and a scoring function can use the AI module.

**Future needs:**
- Minimax / tree search for games with adversarial depth (Chess AI, Connect 4)
- Monte Carlo Tree Search for complex state spaces
- AI difficulty levels (easy = more random, hard = more optimal)

---

## 3. Board Module Too Chess-Specific

**Exposed by:** Ludo

**Problem:** `@engine/board.js` has `buildBoardMap`, `isLegalMove`, `isPathClear` — all
designed for chess-style grid movement with piece types and sliding/stepping/leaping.
None of this works for Ludo's track-based movement.

**Current state:** Ludo doesn't use board.js at all. It implements its own:
- `trackToPixel()` — map track position to pixel coordinates
- `getValidMoves()` — dice-based movement validation
- `checkCapture()` — position-overlap capture logic

**Recommendation:** Rename `board.js` → `chess-board.js` or split into:
- `@engine/board-grid.js` — grid-based board games (Chess, Checkers, Othello)
- `@engine/board-track.js` — track-based games (Ludo, Monopoly, Sorry!)
- `@engine/board-hex.js` — hex grid games (Settlers, hex chess)

Or better: make a generic `@engine/path.js` module:
```javascript
export function definePath(waypoints) { ... }
export function moveAlongPath(pos, steps, path) { ... }
export function isOccupied(pos, entities) { ... }
export function captureAt(pos, enemies) { ... }
```

---

## 4. Grid Module Doesn't Cover Track/Path Games

**Exposed by:** Ludo

**Problem:** `@engine/grid.js` has `rotateShape`, `collides`, `clearLines`, `wrapPosition`,
`selfCollides` — all designed for rectangular grid games (Tetris, Snake). None of these
work for Ludo's circular track with branches.

**Gap areas:**
- No track/path data structure (ordered list of positions forming a circuit)
- No branching paths (main track → home column)
- No dice/random number generation helpers
- No turn management for >2 players

**Recommendation:** Add `@engine/path.js`:
```javascript
export function defineTrack(positions, opts) { ... }  // Circular or linear
export function branchAt(track, position, branch) { ... }
export function advanceOnTrack(currentPos, steps, track) { ... }
export function findOccupants(pos, tokens) { ... }
```

---

## 5. Render Module Lacked Non-Grid Drawing Primitives

**Exposed by:** Ludo

**Problem:** All render helpers assumed grid-cell positioning:
- `drawCell(ctx, offsetX, offsetY, cellSize, gx, gy, ...)` — grid coordinates
- `drawEntitiesAsText(...)` — grid-positioned unicode
- No circles, no dice, no arbitrary-position tokens

**Solution:** Added to render.js:
- `drawToken(ctx, cx, cy, radius, color, opts)` — circular tokens with labels
- `drawDice(ctx, x, y, size, value, opts)` — dice face with dots
- `drawSquare(ctx, x, y, w, h, color, stroke)` — arbitrary positioned rectangles

**Lesson learned:** The render module needs two layers:
1. **Grid primitives** — `drawCell`, `drawGridBoard`, `drawPieceCells` (grid-coordinate based)
2. **Pixel primitives** — `drawToken`, `drawDice`, `drawSquare` (pixel-coordinate based)

Grid games use layer 1 (which internally calls layer 2). Non-grid games use layer 2 directly.
Currently both layers are mixed in one file.

**Recommendation:** Consider splitting:
- `@engine/render-grid.js` — grid-specific (drawGridBoard, drawPieceCells, etc.)
- `@engine/render-primitives.js` — low-level (drawToken, drawDice, drawCircle, drawSquare)
- `@engine/render-hud.js` — HUD and overlay (drawHUD, drawGameOver)

---

## 6. No Turn Management System

**Exposed by:** Ludo (4 players), partially by Chess (2 players)

**Problem:** Turn management is hand-coded in each game. Chess manually toggles
`state.currentTurn` between `'white'` and `'black'`. Ludo implements `nextPlayer()` that
cycles through 4 players. Both handle "extra turn on special condition" (6 in Ludo, not in Chess).

**Current state:** Each game reinvents:
- Turn order tracking
- Turn switching conditions
- Extra turn logic
- Skip turn conditions

**Recommendation:** Add `@engine/turns.js`:
```javascript
export function createTurnManager(players, opts) {
  return {
    current() { ... },
    next() { ... },
    skip() { ... },
    extraTurn() { ... },
    onTurnEnd(callback) { ... },
  };
}
```

---

## 7. Restart Logic Is Incomplete

**Exposed by:** Ludo, Tetris, Snake

**Problem:** core.js restart handler only resets `_board.grid` and `state`. But:
- Tetris needs to destroy all Active entities
- Snake needs to respawn the snake entity
- Ludo needs to reset all 16 tokens to home base and clear turn state
- Chess needs to destroy all pieces and respawn them

**Current workaround:** Each game handles restart in its own spawn system
(check `_spawned` flag). But the core restart handler is too simplistic.

**Recommendation:** Let games register a custom `onRestart` callback:
```javascript
game.onRestart((world) => {
  // Game-specific cleanup
  for (const eid of world.query('Token')) {
    const tok = world.getComponent(eid, 'Token');
    tok.pos = -1;
    tok.finished = false;
  }
});
```

---

## 8. No Animation/Tween System

**Exposed by:** Ludo (token movement should animate along track)

**Problem:** Movement is instant — token teleports from position A to B.
In a real Ludo game, you'd see the token hop along each cell. Same issue
exists in Chess (piece slides) and Snake (could be smoother).

**Current state:** No animation support. Would need:
- Position interpolation (lerp between start/end)
- Tween functions (ease-in, ease-out, bounce)
- Animation queue (wait for animation before next action)
- Per-entity animation state

**Impact:** Medium. Games are playable without animations, but feel static.
This is a significant effort to add properly.

**Recommendation:** Add `@engine/animate.js`:
```javascript
export function tween(entity, property, from, to, duration, easing) { ... }
export function animateAlongPath(entity, waypoints, speed) { ... }
export function waitForAnimation(entity) { ... }
```

---

## 9. Event System Is Frame-Scoped Only

**Exposed by:** Ludo (cross-system coordination needed across frames)

**Problem:** `world.emit()` events are cleared every frame in `world.tick()`.
This is fine for single-frame pipelines (Tetris: lock → clear → score in one tick).
But Ludo needs multi-frame coordination:
- Frame 1: Roll dice
- Frame 2-5: Animate token movement
- Frame 6: Check capture
- Frame 7: Check win

**Workaround:** Used `turn.phase` state machine instead of events. Works, but
means the turn system is one monolithic function rather than decoupled systems.

**Recommendation:** Add persistent events or a state machine helper:
```javascript
export function createStateMachine(states, transitions) { ... }
// or
world.emitPersistent('diceRolled', { value: 6 }); // Survives until consumed
world.consumeEvent('diceRolled'); // Explicitly clear
```

---

## 10. `roundRect` Not Available Everywhere

**Exposed by:** Ludo (dice drawing)

**Problem:** `ctx.roundRect()` is used in `drawDice` but is relatively new
(Chrome 99+, Firefox 112+, Safari 15.4+). Older browsers will crash.

**Recommendation:** Add a polyfill or fallback in render.js:
```javascript
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return;
  }
  // Manual arc-based fallback
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  // ... etc
}
```

---

## Summary: SDK Module Evolution Needed

| Current Module | Works For | Fails For | Proposed Split/Addition |
|---------------|-----------|-----------|------------------------|
| core.js | All (after fix) | Custom canvas was missing | Now fixed |
| grid.js | Tetris, Snake | Ludo, Monopoly, card games | Add path.js |
| board.js | Chess | Ludo, non-chess board games | Split into board-grid, board-track |
| render.js | All (after additions) | Getting bloated | Split into primitives + grid + hud |
| input.js | All human-controlled | AI-only games don't need it | Fine as-is |
| ai.js | Ludo (new) | Deep strategy games | Add minimax, MCTS |
| — | — | All multi-frame games | Add animate.js |
| — | — | All multi-player games | Add turns.js |
| — | — | All games with dice/random | Add random.js |

## Priority Order for Fixes

1. **turns.js** — High value, low effort. Every game needs turns.
2. **path.js** — Unlocks track-based board games (Ludo, Monopoly, etc.)
3. **render split** — Code organization, prevents render.js from becoming 1000+ lines
4. **animate.js** — High visual impact but significant effort
5. **board.js rename** — Clarity, prevents confusion about chess-specificity
6. **Event system upgrade** — Unlocks complex multi-frame game logic
