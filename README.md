# Game Studio

CLI tool for creating, building, evaluating, and publishing ECS-based HTML5 games using the [@engine SDK](https://github.com/agadabanka/game-factory).

Part of the **Game Factory ecosystem** — a two-path system for game creation:

| Path | Tool | Flow |
|------|------|------|
| **Web UI** | [Game Factory](https://github.com/agadabanka/game-factory) | Describe game → AI generates spec → eval loop → publish |
| **CLI** | Game Studio (this repo) | Write game.js with @engine SDK → build → eval → publish |

Both paths share the same engine SDK, eval system, and GitHub integration. Improvements discovered via CLI development feed back into the SDK, making Web UI games better too.

## 29 Published Games

| Genre | Games |
|-------|-------|
| **Board (7)** | [Chess](https://github.com/agadabanka/chess), [Checkers](https://github.com/agadabanka/checkers), [Ludo](https://github.com/agadabanka/ludo), [Reversi](https://github.com/agadabanka/reversi), [Gomoku](https://github.com/agadabanka/gomoku), [Connect 4](https://github.com/agadabanka/connect4), [Tic-Tac-Toe](https://github.com/agadabanka/tic-tac-toe) |
| **Puzzle (6)** | [Tetris](https://github.com/agadabanka/tetris), [2048](https://github.com/agadabanka/game2048), [Sudoku](https://github.com/agadabanka/sudoku), [Sliding Puzzle](https://github.com/agadabanka/sliding-puzzle), [Minesweeper](https://github.com/agadabanka/minesweeper), [Wordle](https://github.com/agadabanka/wordle) |
| **Arcade (7)** | [Snake](https://github.com/agadabanka/snake), [Pong](https://github.com/agadabanka/pong), [Breakout](https://github.com/agadabanka/breakout), [Flappy](https://github.com/agadabanka/flappy), [Space Invaders](https://github.com/agadabanka/space-invaders), [Whack-a-Mole](https://github.com/agadabanka/whack-a-mole), [Simon](https://github.com/agadabanka/simon) |
| **Card (2)** | [Solitaire](https://github.com/agadabanka/solitaire), [Blackjack](https://github.com/agadabanka/blackjack) |
| **Strategy (3)** | [Tower Defense](https://github.com/agadabanka/tower-defense), [Roguelike](https://github.com/agadabanka/roguelike), [Battleship](https://github.com/agadabanka/battleship) |
| **Casual (4)** | [Match 3](https://github.com/agadabanka/match3), [Memory](https://github.com/agadabanka/memory), [Lights Out](https://github.com/agadabanka/lights-out), [Hangman](https://github.com/agadabanka/hangman) |

## Quick Start

```bash
# Install
npm link              # Makes 'game-studio' available globally

# Create a new game
game-studio init my-game
cd my-game

# Pull the latest engine SDK
game-studio pull-sdk

# Edit game.js — write your game logic using @engine SDK

# Build standalone bundle
game-studio build

# Play locally
game-studio serve     # → http://localhost:8080

# AI quality evaluation
game-studio eval      # Score 0-100 via Claude
game-studio eval --fix  # Auto-fix if score < 80

# Generate title card
game-studio title-card  # AI-generated via Gemini

# Publish to GitHub
game-studio publish
```

## How a Game is Built

Every game is a single `game.js` file using the **Entity-Component-System** pattern:

```javascript
import { defineGame } from '@engine/core';
import { consumeAction } from '@engine/input';
import { clearCanvas, drawHUD, drawGameOver } from '@engine/render';

const game = defineGame({
  display: { type: 'grid', width: 10, height: 20, cellSize: 30, background: '#111' },
  input: {
    left:    { keys: ['ArrowLeft', 'a'] },
    right:   { keys: ['ArrowRight', 'd'] },
    action:  { keys: [' ', 'Enter'] },
    restart: { keys: ['r'] },
  },
});

// Components — data shapes for entities
game.component('Position', { x: 0, y: 0 });
game.component('Velocity', { dx: 0, dy: 0 });

// Resources — shared singletons
game.resource('state', { score: 0, level: 1, gameOver: false });

// Systems — behavior, run every frame in order
game.system('spawn', (world, dt) => { /* create entities once */ });
game.system('input', (world, dt) => { /* read keyboard */ });
game.system('logic', (world, dt) => { /* game rules */ });
game.system('render', (world, dt) => { /* draw everything */ });

export default game;
```

### ECS in 30 Seconds

- **Entity**: A numeric ID (0, 1, 2...) — just a handle
- **Component**: Data attached to an entity (`Position { x, y }`, `Health { hp }`)
- **System**: A function that queries entities by component and acts on them
- **Resource**: A singleton value shared across all systems (`state`, `input`, `renderer`)

```
world.createEntity() → 42
world.addComponent(42, 'Position', { x: 5, y: 10 })
world.query('Position') → [42, ...]  // all entities with Position
world.getComponent(42, 'Position') → { x: 5, y: 10 }
```

## @engine SDK Modules

| Module | Key Exports | Use For |
|--------|------------|---------|
| `@engine/core` | `defineGame` → `.component()`, `.resource()`, `.system()`, `.start()` | Every game |
| `@engine/grid` | `rotateShape`, `collides`, `clearLines`, `wrapPosition`, `randomFreePos`, `selfCollides`, `ghostY`, `lockCells` | Grid games (Tetris, Snake, Minesweeper) |
| `@engine/render` | `clearCanvas`, `drawGridBoard`, `drawPieceCells`, `drawCheckerboard`, `drawSnake`, `drawFood`, `drawToken`, `drawDice`, `drawSquare`, `drawHUD`, `drawGameOver`, `drawHighlight`, `drawEntitiesAsText` | Every game |
| `@engine/board` | `buildBoardMap`, `isLegalMove`, `isPathClear` | Chess-style board games |
| `@engine/input` | `consumeAction`, `moveCursor` | Human-controlled games |
| `@engine/ai` | `pickBestMove`, `pickWeightedMove`, `pickRandomMove`, `compositeEvaluator` | Games with AI opponents |

### Display Modes

**Grid** (`type: 'grid'`): Auto-sized canvas. Set `width`, `height`, `cellSize`. Use `drawGridBoard`, `drawPieceCells`.

**Custom** (`type: 'custom'`): Pixel-exact canvas. Set `canvasWidth`, `canvasHeight`, `offsetX`, `offsetY`. Use `drawToken`, `drawSquare`, `drawDice`.

## CLI Commands

| Command | Description |
|---------|-------------|
| `init <name>` | Scaffold a new game project with template |
| `pull-sdk` | Download latest @engine SDK from Game Factory |
| `build [--remote]` | Bundle game.js → dist/game.bundle.js via esbuild-wasm |
| `serve [--port]` | Start local dev server (default port 8080) |
| `eval` | Run AI quality evaluation (Claude, score 0-100) |
| `eval --fix` | Eval + auto-apply fixes if score < 80 |
| `fix` | Analyze open GitHub issues for fixes (dry run) |
| `fix --apply` | Apply fixes and close issues |
| `publish` | Push game to GitHub (creates repo if needed) |
| `info` | Show project config and architecture diagram |
| `title-card` | Generate AI title card via Gemini API |

## Architecture

```
  Developer                      Game Factory Server
  ┌───────────────┐              ┌──────────────────┐
  │ game-studio   │── pull-sdk ─▶│ /api/sdk         │ @engine modules
  │               │── build ────▶│ /api/compile     │ esbuild-wasm
  │ game.js       │── eval ─────▶│ /api/eval        │ Claude scoring
  │ (@engine SDK) │── fix ──────▶│ /api/fix-issues  │ Auto-fix
  └───────┬───────┘              └────────┬─────────┘
          │ publish                       │ feedback loop
          ▼                               ▼
  ┌───────────────┐              ┌──────────────────┐
  │ GitHub Repo   │              │ @engine SDK      │
  │ (your game)   │              │ (improved)       │
  └───────────────┘              └──────────────────┘
```

### The Feedback Loop

```
Developer writes game → eval scores < 80 → bug in @engine? → filed on game-factory
    ↑                                                              │
    └──────────── SDK updated ← fix merged ←───────────────────────┘
```

Eval bugs classified as "compiler limitations" get filed on game-factory. Fixes improve
the SDK for everyone — both CLI developers and Web UI users.

## Configuration

`game-studio.json` in your project root:

```json
{
  "name": "my-game",
  "factory": "http://localhost:3000",
  "github": { "owner": "agadabanka", "repo": "my-game" },
  "engine": { "version": "latest" }
}
```

## Project Structure

```
game-studio/               # This repo — the CLI
├── bin/game-studio.js     # CLI entry point
├── lib/                   # Command implementations
├── docs/                  # Book chapters, title cards, pitch deck
├── ARCHITECTURE.md        # Full system architecture
├── LEARNINGS.md           # SDK gaps from building 4 games
├── CLAUDE.md              # Context for Claude Code sessions
├── game-studio-book.pdf   # 57-page documentation book
└── pitch-deck.pdf         # 15-slide VC pitch deck

<your-game>/               # Created by `game-studio init`
├── game.js                # Your game source (ECS pattern)
├── game-studio.json       # Project config
├── index.html             # Playable page with title card overlay
├── engine/                # @engine SDK (from pull-sdk)
├── dist/game.bundle.js    # Built bundle (from build)
└── assets/title-card.png  # AI-generated title card
```

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — Full system diagram, data flow, module dependencies
- **[LEARNINGS.md](LEARNINGS.md)** — SDK generalization gaps discovered from Chess, Tetris, Snake, Ludo
- **[CLAUDE.md](CLAUDE.md)** — Complete project context for Claude Code sessions
- **[game-studio-book.pdf](game-studio-book.pdf)** — 57-page illustrated project book
- **[pitch-deck.pdf](pitch-deck.pdf)** — 15-slide VC pitch deck

## Related Repos

- [Game Factory](https://github.com/agadabanka/game-factory) — Web UI + engine server
- [Chess](https://github.com/agadabanka/chess) · [Tetris](https://github.com/agadabanka/tetris) · [Snake](https://github.com/agadabanka/snake) · [Ludo](https://github.com/agadabanka/ludo) — Battle-tested @engine games
