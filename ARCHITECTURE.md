# Game Studio Architecture

## System Overview

Game Studio is the CLI companion to Game Factory. Together they form a two-path
system for creating high-quality ECS games:

**Path 1: User → Game Factory (Web UI) → Game on GitHub**
- User describes a game in natural language
- Game Factory generates a JSON spec via Claude
- Eval loop scores quality, files bugs, auto-fixes
- Game is published to GitHub

**Path 2: Developer → Claude Code → game-studio CLI → Game on GitHub**
- Developer writes game.js using @engine SDK
- CLI bundles, evaluates, and publishes
- Eval bugs feed back into common libraries
- Battle-hardened libraries improve Path 1 quality

Both paths share the same common libraries, eval system, and GitHub integration.

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         GAME CREATION SYSTEM                            │
├──────────────────────────────────┬───────────────────────────────────────┤
│                                  │                                       │
│   PATH 1: Web UI                 │   PATH 2: Claude Code + CLI          │
│                                  │                                       │
│   ┌─────────────┐               │   ┌─────────────────────────┐        │
│   │  User       │               │   │  Developer              │        │
│   │  (Browser)  │               │   │  (Claude Code terminal) │        │
│   └──────┬──────┘               │   └───────────┬─────────────┘        │
│          │                       │               │                       │
│          │ "Make a               │               │ game-studio init      │
│          │  chess game"          │               │ (scaffold)            │
│          ▼                       │               ▼                       │
│   ┌─────────────┐               │   ┌─────────────────────────┐        │
│   │ Game Factory│               │   │  game.js                │        │
│   │  Web UI     │               │   │  (TypeScript IL source) │        │
│   │             │               │   │  using @engine/* SDK    │        │
│   │ - Prompt    │               │   └───────────┬─────────────┘        │
│   │ - Library   │               │               │                       │
│   │ - Canvas    │               │               │ game-studio build     │
│   └──────┬──────┘               │               │ game-studio eval      │
│          │                       │               │ game-studio publish   │
│          │                       │               │                       │
├──────────┴───────────────────────┴───────────────┴───────────────────────┤
│                                                                          │
│                     GAME FACTORY SERVER                                   │
│                     (Common Backend)                                      │
│                                                                          │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│   │  /api/sdk    │  │ /api/compile │  │  /api/eval   │                  │
│   │              │  │              │  │              │                  │
│   │  Serve       │  │  esbuild-    │  │  Claude QA   │                  │
│   │  @engine/*   │  │  wasm        │  │  Score 0-100 │                  │
│   │  modules     │  │  bundler     │  │  Bug list    │                  │
│   └──────────────┘  └──────────────┘  │  Fixed spec  │                  │
│                                        └──────┬───────┘                  │
│   ┌──────────────┐  ┌──────────────┐          │                          │
│   │ /api/generate│  │/api/fix-issues│         │                          │
│   │              │  │              │          │ score < 80               │
│   │  Claude LLM  │  │  Claude +    │          │ → create issues          │
│   │  → JSON spec │  │  GitHub      │          │ → file compiler bugs     │
│   │              │  │  auto-fix    │          │                          │
│   └──────────────┘  └──────────────┘          │                          │
│                                                │                          │
├────────────────────────────────────────────────┴──────────────────────────┤
│                                                                          │
│                     @ENGINE SDK (Common Libraries)                        │
│                                                                          │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│   │ core.js │ │ grid.js │ │render.js│ │ board.js│ │ input.js│         │
│   │         │ │         │ │         │ │         │ │         │         │
│   │defineGame│ │rotate   │ │drawGrid │ │boardMap │ │consume  │         │
│   │component│ │collide  │ │drawSnake│ │legalMove│ │moveCursr│         │
│   │resource │ │clearLine│ │drawPiece│ │pathClear│ │         │         │
│   │system   │ │wrap     │ │drawHUD  │ │inBounds │ │         │         │
│   │start    │ │ghostY   │ │drawFood │ │         │ │         │         │
│   └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘         │
│         │           │           │           │           │                │
│         └───────────┴───────────┴───────────┴───────────┘                │
│                              Used by                                     │
│         ┌───────────┬───────────────────┬──────────────┐                │
│         ▼           ▼                   ▼              ▼                │
│   ┌──────────┐ ┌──────────┐      ┌──────────┐  ┌──────────┐           │
│   │  Chess   │ │  Tetris  │      │  Snake   │  │ User Gen │           │
│   │  24KB    │ │  19KB    │      │  17KB    │  │  Games   │           │
│   └────┬─────┘ └────┬─────┘      └────┬─────┘  └────┬─────┘           │
│        │            │                  │             │                  │
├────────┴────────────┴──────────────────┴─────────────┴──────────────────┤
│                                                                          │
│                     GITHUB (Published Games)                             │
│                                                                          │
│   agadabanka/chess    agadabanka/tetris    agadabanka/snake              │
│   agadabanka/game-factory    agadabanka/game-studio                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Feedback Loop

The key architectural insight is the **feedback loop** between game development
and library improvement:

```
   Developer writes game          Game passes eval
   using @engine SDK              (score >= 80)
         │                              │
         ▼                              ▼
   game-studio eval              Patterns validated ──────┐
         │                                                 │
         ▼                                                 │
   Score < 80                                              │
   Bugs found                                              │
         │                                                 │
         ├── Bug in game.js? ──► Developer fixes           │
         │                                                 │
         └── Bug in @engine? ──► Compiler bug filed ───┐   │
                                 on game-factory repo  │   │
                                                       ▼   ▼
                                              @engine SDK updated
                                              with fix/improvement
                                                       │
                                                       ▼
                                              All games benefit
                                              (pull-sdk to update)
```

### What feeds back into common libraries:

1. **Eval bugs that are "compiler limitations"** → filed as issues on game-factory
2. **Render patterns** that work across multiple games → promoted to @engine/render.js
3. **Grid mechanics** (rotation, collision) validated across Tetris/Snake → @engine/grid.js
4. **Board game logic** (move validation, turns) validated in Chess → @engine/board.js
5. **Quality scores** across many games → confidence that SDK produces good games

### What stays game-specific:

1. **Piece definitions** (chess pieces, tetrominos, snake behavior)
2. **Game rules** (scoring formulas, level progression curves)
3. **Visual theme** (colors, fonts, background)
4. **Input mapping** (which keys do what)

---

## Data Flow: Creating a Game

```
1. INIT
   game-studio init my-game
   └── Creates: game.js, game-studio.json, index.html, engine/

2. PULL SDK
   game-studio pull-sdk
   └── GET /api/sdk → downloads @engine modules to engine/

3. DEVELOP
   Edit game.js (using @engine/core, @engine/grid, etc.)
   └── Developer or Claude Code writes game logic

4. BUILD
   game-studio build
   └── POST /api/compile { source } → esbuild-wasm → dist/game.bundle.js
       (or local esbuild-wasm with engine/ modules)

5. PLAY
   game-studio serve
   └── http://localhost:8080 → loads index.html → imports game.bundle.js

6. EVAL
   game-studio eval
   └── POST /api/eval { spec, sourceCode }
       → Claude analyzes quality
       → Returns: { score, bugs, fixed_spec }

7. FIX (if score < 80)
   game-studio eval --fix
   └── Applies Claude's fixes to game.js automatically

8. PUBLISH
   game-studio publish
   └── gh repo create (if needed)
       gh api PUT contents/game.js, dist/game.bundle.js, ...

9. FEEDBACK
   Eval bugs classified as "compiler limitation"
   └── Filed on agadabanka/game-factory as compiler-bug
       → Fixed in @engine SDK
       → game-studio pull-sdk to get updated libs
```

---

## Module Dependency Graph

```
game.js (your game)
  ├── @engine/core    → defineGame, component, resource, system, start
  │     └── @engine/ecs  → World (createEntity, addComponent, query, tick)
  ├── @engine/grid    → rotateShape, collides, clearLines, wrapPosition, ...
  ├── @engine/render  → drawGridBoard, drawPieceCells, drawSnake, drawHUD, ...
  ├── @engine/board   → buildBoardMap, isLegalMove, isPathClear (board games only)
  └── @engine/input   → consumeAction, moveCursor
```

## SDK Module Usage by Game Type

| Module | Puzzle (Tetris) | Arcade (Snake) | Board (Chess) |
|--------|----------------|----------------|---------------|
| core   | defineGame, system | defineGame, system | defineGame, system |
| grid   | rotateShape, collides, clearLines, ghostY, lockCells | wrapPosition, selfCollides, randomFreePosition | — |
| render | drawGridBoard, drawPieceCells, drawPreview | drawSnake, drawFood | drawCheckerboard, drawEntitiesAsText, drawHighlight |
| board  | — | — | buildBoardMap, isLegalMove |
| input  | consumeAction | consumeAction | consumeAction, moveCursor |
