# CLAUDE.md — Project Context for Claude Code

## What This Project Is

Game Studio is the CLI half of a two-path game creation system. The other half is
[Game Factory](https://github.com/agadabanka/game-factory) (web UI). Both share the
same @engine SDK and produce standalone HTML5 games published to GitHub.

- **Path 1 (Web UI):** User describes game → Game Factory generates JSON spec → eval loop → publish
- **Path 2 (CLI):** Developer writes game.js using @engine SDK → build → eval → publish

## How to Add a New Game

Every game follows this pipeline:

```bash
game-studio init <name>      # 1. Scaffold project
cd <name>
game-studio pull-sdk         # 2. Download @engine modules to engine/
# Edit game.js               # 3. Write game logic (ECS pattern)
game-studio build            # 4. Bundle → dist/game.bundle.js
game-studio serve            # 5. Play at localhost:8080
game-studio eval             # 6. AI quality score (0-100)
game-studio eval --fix       # 7. Auto-fix if score < 80
game-studio title-card       # 8. Generate title card (Gemini API)
game-studio publish          # 9. Push to GitHub repo
```

## Game Structure (ECS Pattern)

Every game is a single `game.js` file:

```javascript
import { defineGame } from '@engine/core';
import { consumeAction } from '@engine/input';
import { clearCanvas, drawBorder, drawHUD, drawGameOver } from '@engine/render';

const game = defineGame({
  display: {
    type: 'grid',          // 'grid' (auto-sized) or 'custom' (explicit pixels)
    width: 10, height: 10, // grid columns/rows
    cellSize: 40,          // pixels per cell
    background: '#111',
    // For custom: canvasWidth, canvasHeight, offsetX, offsetY
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

// Components — data shapes attached to entities
game.component('Position', { x: 0, y: 0 });

// Resources — singletons shared across systems
game.resource('state', { score: 0, level: 1, gameOver: false });

// Systems — run every frame in registration order
game.system('spawn', (world, dt) => {
  if (world.getResource('_spawned')) return;
  world.setResource('_spawned', true);
  const eid = world.createEntity();
  world.addComponent(eid, 'Position', { x: 5, y: 5 });
});

game.system('input', (world, dt) => {
  const input = world.getResource('input');
  if (consumeAction(input, 'action')) { /* handle */ }
});

game.system('render', (world, dt) => {
  const { ctx, cellSize, offsetX, offsetY } = world.getResource('renderer');
  clearCanvas(ctx, '#111');
  // draw game state...
  drawHUD(ctx, state, offsetX, W, offsetY, { fields: ['score'], fontSize: 18 });
});

export default game;
```

## @engine SDK Modules

| Module | Key Exports | Use When |
|--------|------------|----------|
| `@engine/core` | `defineGame` → `.component()`, `.resource()`, `.system()`, `.start()` | Every game |
| `@engine/ecs` | `world.createEntity()`, `.destroyEntity()`, `.addComponent()`, `.getComponent()`, `.removeComponent()`, `.query()`, `.getResource()`, `.setResource()`, `.emit()`, `.on()` | Used internally by core |
| `@engine/grid` | `rotateShape`, `collides`, `ghostY`, `lockCells`, `clearLines`, `wrapPosition`, `randomFreePos`, `selfCollides` | Grid-cell games (Tetris, Snake, Minesweeper) |
| `@engine/render` | `clearCanvas`, `drawBorder`, `drawGridBoard`, `drawPieceCells`, `drawCheckerboard`, `drawSnake`, `drawFood`, `drawEntitiesAsText`, `drawHighlight`, `drawToken`, `drawDice`, `drawSquare`, `drawHUD`, `drawGameOver` | Every game |
| `@engine/board` | `buildBoardMap`, `isLegalMove`, `isPathClear` | Chess-style board games only |
| `@engine/input` | `consumeAction`, `moveCursor` | Every game with human input |
| `@engine/ai` | `pickBestMove`, `pickWeightedMove`, `pickRandomMove`, `compositeEvaluator` | Games with AI opponents |

### Display Types

- **Grid** (`type: 'grid'`): Canvas auto-sized as `width * cellSize + 180` (HUD). Use `drawGridBoard`, `drawPieceCells`.
- **Custom** (`type: 'custom'`): Explicit `canvasWidth`, `canvasHeight`, `offsetX`, `offsetY`. Use pixel-based `drawToken`, `drawSquare`, `drawDice`.

## The 29 Published Games

| Genre | Count | Games |
|-------|-------|-------|
| Board | 7 | Chess, Checkers, Ludo, Reversi, Gomoku, Connect 4, Tic-Tac-Toe |
| Puzzle | 6 | Tetris, 2048, Sudoku, Sliding Puzzle, Minesweeper, Wordle |
| Arcade | 7 | Snake, Pong, Breakout, Flappy, Space Invaders, Whack-a-Mole, Simon |
| Card | 2 | Solitaire, Blackjack |
| Strategy | 3 | Tower Defense, Roguelike, Battleship |
| Casual | 4 | Match 3, Memory, Lights Out, Hangman |

All published at `github.com/agadabanka/<game-name>`.

Bundle sizes: 10-24KB. Complexity: 1-2 systems (Tic-Tac-Toe) → 6-8+ systems (Ludo, Roguelike).

## CLI Commands

| Command | Module | Purpose |
|---------|--------|---------|
| `init <name>` | `lib/init.js` | Scaffold game project |
| `pull-sdk` | `lib/pull-sdk.js` | Download @engine modules from Game Factory `/api/sdk` |
| `build [--remote]` | `lib/build.js` | Bundle via esbuild-wasm (local) or `/api/compile` (remote) |
| `serve [--port]` | `lib/serve.js` | Local dev server at :8080 |
| `eval [--fix]` | `lib/eval.js` | AI quality eval via `/api/eval` (Claude, 0-100 score) |
| `fix [--apply]` | `lib/fix.js` | Auto-fix GitHub issues via `/api/fix-issues` |
| `publish` | `lib/publish.js` | Push to GitHub via `gh` CLI |
| `info` | `lib/info.js` | Show project config |
| `title-card` | `lib/title-card.js` | Generate title card via Gemini API |

## Project File Structure

```
game-studio/
├── bin/game-studio.js       # CLI entry point & command dispatcher
├── lib/                     # Command implementations
│   ├── init.js              # Scaffolds new game projects
│   ├── build.js             # esbuild-wasm bundling with virtual plugin for @engine/*
│   ├── serve.js             # HTTP dev server
│   ├── eval.js              # Claude-based quality scoring
│   ├── fix.js               # GitHub issue auto-fixer
│   ├── publish.js           # GitHub publish via Contents API
│   ├── pull-sdk.js          # SDK downloader
│   ├── info.js              # Project info display
│   └── title-card.js        # Gemini AI title card generator
├── docs/                    # Book chapters, title cards, pitch deck scripts
├── ARCHITECTURE.md          # Full system diagram & feedback loop
├── LEARNINGS.md             # SDK gaps found from building 4 games
├── game-studio-book.pdf     # 57-page project documentation book
├── pitch-deck.pdf           # 15-slide VC pitch deck
└── package.json             # Only dep: esbuild-wasm
```

Each scaffolded game project:
```
<game-name>/
├── game.js              # Your game source (ECS pattern)
├── game-studio.json     # Config: name, factory URL, github owner/repo
├── index.html           # Playable page with title card overlay
├── engine/              # @engine SDK modules (from pull-sdk)
├── dist/game.bundle.js  # Built bundle (from build)
└── assets/title-card.png
```

## Known SDK Gaps (from LEARNINGS.md)

Priority fixes needed:
1. **No turns.js** — Turn management hand-coded in each game
2. **No path.js** — Track-based games (Ludo) can't use grid.js or board.js
3. **render.js bloat** — Should split into render-grid, render-primitives, render-hud
4. **No animate.js** — Movement is instant, no tweening
5. **board.js too chess-specific** — Needs board-grid, board-track, board-hex variants
6. **Events are frame-scoped** — Multi-frame coordination requires state machine workaround
7. **Restart logic incomplete** — Each game reinvents restart; need `game.onRestart()` callback

## Key Architecture Concepts

- **ECS**: Entity-Component-System. Entities are IDs, components are data, systems are behavior.
- **Feedback loop**: eval bugs → compiler limitations filed on game-factory → SDK improved → all games benefit
- **esbuild-wasm virtual plugin**: Resolves `@engine/*` imports to local engine/ files without filesystem access
- **Two build paths**: Local (esbuild-wasm + engine/) or remote (Game Factory `/api/compile`)
- **Eval loop**: Claude scores 0-100; < 80 triggers bug filing or auto-fix
