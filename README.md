# Game Studio

CLI tool for creating, building, evaluating, and publishing games using the [Game Factory](https://github.com/agadabanka/game-factory) engine SDK.

## Quick Start

```bash
# Scaffold a new game
game-studio init my-game
cd my-game

# Pull the latest engine SDK
game-studio pull-sdk

# Edit game.js (your game logic using @engine SDK)

# Build standalone bundle
game-studio build

# Play locally
game-studio serve
# → http://localhost:8080

# Run AI quality eval
game-studio eval

# Publish to GitHub
game-studio publish
```

## Commands

| Command | Description |
|---------|-------------|
| `init <name>` | Scaffold a new game project with template |
| `build` | Bundle game.js → dist/game.bundle.js via esbuild-wasm |
| `eval` | Run AI quality evaluation (score 0-100, bug detection) |
| `eval --fix` | Eval + auto-apply fixes if score < 80 |
| `fix` | Analyze open GitHub issues for fixes |
| `fix --apply` | Apply fixes and close issues |
| `publish` | Push game to GitHub (creates repo if needed) |
| `pull-sdk` | Download latest @engine SDK from Game Factory |
| `serve` | Start local dev server on port 8080 |
| `info` | Show project config and architecture diagram |

## Configuration

`game-studio.json` in your project root:

```json
{
  "name": "my-game",
  "factory": "http://localhost:3000",
  "github": {
    "owner": "your-username",
    "repo": "my-game"
  }
}
```

## @engine SDK

Your game imports from these modules:

| Module | What it provides |
|--------|-----------------|
| `@engine/core` | `defineGame()` — components, resources, systems, game loop |
| `@engine/grid` | Piece rotation, collision, line clearing, wrapping, self-collision |
| `@engine/render` | Canvas drawing: grid, pieces, snake, food, HUD, game over |
| `@engine/board` | Board game helpers: move validation, path checking |
| `@engine/input` | Input helpers: action consumption, cursor movement |

## How It Works

```
  You (Claude Code)              Game Factory
  ┌───────────────┐              ┌──────────────┐
  │ game-studio   │── pull-sdk ─▶│ /api/sdk     │
  │               │── build ────▶│ /api/compile  │
  │ game.js       │── eval ─────▶│ /api/eval    │
  │               │── fix ──────▶│ /api/fix     │
  └───────┬───────┘              └──────┬───────┘
          │ publish                     │ learnings
          ▼                             ▼
  ┌───────────────┐              ┌──────────────┐
  │ GitHub Repo   │              │ @engine SDK  │
  │ (your game)   │              │ (improved)   │
  └───────────────┘              └──────────────┘
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system diagram.

## Related

- [Game Factory](https://github.com/agadabanka/game-factory) — Web UI + common engine
- [Chess](https://github.com/agadabanka/chess) — Chess built with @engine SDK
- [Tetris](https://github.com/agadabanka/tetris) — Tetris built with @engine SDK
- [Snake](https://github.com/agadabanka/snake) — Snake built with @engine SDK
