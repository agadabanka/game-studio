#!/usr/bin/env python3
"""Chapter 7: Architecture Diagrams"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from book_styles import BookPDF, ACCENT_BLUE, ACCENT_GREEN, ACCENT_ORANGE

pdf = BookPDF("Architecture Diagrams")

pdf.chapter_cover(7, "Architecture Diagrams", "System, Data Flow & Dependencies")

pdf.add_page()
pdf.section_title("Full System Architecture")
pdf.body_text(
    "This chapter provides visual reference diagrams for the entire Game Studio ecosystem. "
    "These diagrams capture the relationships between the CLI, server, engine, and published games."
)

pdf.diagram_box("Complete System Architecture", """
+------------------------------------------------------------------------+
|                         GAME CREATION SYSTEM                           |
+----------------------------------+-------------------------------------+
|                                  |                                     |
|   PATH 1: Web UI                |   PATH 2: Claude Code + CLI         |
|                                  |                                     |
|   +--------------+              |   +--------------------------+      |
|   |  User        |              |   |  Developer               |      |
|   |  (Browser)   |              |   |  (Claude Code terminal)  |      |
|   +------+-------+              |   +-----------+--------------+      |
|          |                       |               |                     |
|          | "Make a               |               | game-studio init    |
|          |  chess game"          |               | (scaffold)          |
|          v                       |               v                     |
|   +--------------+              |   +--------------------------+      |
|   | Game Factory |              |   |  game.js                 |      |
|   |  Web UI      |              |   |  (TypeScript IL source)  |      |
|   |              |              |   |  using @engine/* SDK     |      |
|   | - Prompt     |              |   +--------------------------+      |
|   | - Library    |              |               |                     |
|   | - Canvas     |              |               | game-studio build   |
|   +--------------+              |               | game-studio eval    |
|          |                       |               | game-studio publish |
+----------+-----------------------+---------------+---------------------+
|                                                                        |
|                     GAME FACTORY SERVER                                |
|                     (Common Backend)                                   |
|                                                                        |
|   +--------------+ +--------------+ +--------------+ +--------------+ |
|   |  /api/sdk    | | /api/compile | |  /api/eval   | | /api/generate| |
|   |              | |              | |              | |              | |
|   |  Serve       | |  esbuild-    | |  Claude QA   | |  Claude LLM  | |
|   |  @engine/*   | |  wasm        | |  Score 0-100 | |  -> spec     | |
|   |  modules     | |  bundler     | |  Bug list    | |              | |
|   +--------------+ +--------------+ +--------------+ +--------------+ |
+------------------------------------------------------------------------+
|                                                                        |
|                    @ENGINE SDK (Common Libraries)                       |
|                                                                        |
|   +--------+ +--------+ +--------+ +--------+ +--------+ +--------+  |
|   |core.js | |grid.js | |render  | |board.js| |input.js| | ai.js  |  |
|   |        | |        | |.js     | |        | |        | |        |  |
|   |define  | |rotate  | |draw    | |board   | |consume | |pickBest|  |
|   |Game    | |collide | |Grid    | |Map     | |Action  | |Move    |  |
|   |comp    | |clear   | |draw    | |legal   | |move    | |weighted|  |
|   |system  | |wrap    | |Piece   | |Move    | |Cursor  | |random  |  |
|   |start   | |ghostY  | |drawHUD | |pathClr | |        | |compose |  |
|   +--------+ +--------+ +--------+ +--------+ +--------+ +--------+  |
+------------------------------------------------------------------------+""")

pdf.add_page()
pdf.diagram_box("Data Flow: Creating a Game (Step by Step)", """
  STEP 1: INIT                    STEP 2: PULL SDK
  $ game-studio init my-game      $ game-studio pull-sdk
  +---------------------------+   +---------------------------+
  | Creates:                  |   | GET /api/sdk              |
  |   game.js (template)      |   |   -> { modules: {...} }  |
  |   game-studio.json        |   | Writes to engine/:       |
  |   index.html              |   |   core.js, ecs.js        |
  |   engine/  (empty)        |   |   grid.js, render.js     |
  |   dist/    (empty)        |   |   board.js, input.js     |
  +---------------------------+   +---------------------------+

  STEP 3: DEVELOP                  STEP 4: BUILD
  Edit game.js                     $ game-studio build
  +---------------------------+   +---------------------------+
  | import @engine/core       |   | Read game.js + engine/*   |
  | import @engine/grid       |   | esbuild-wasm virtual FS   |
  | defineGame(...)           |   | Resolve @engine/* imports  |
  | component, resource       |   | Bundle -> ESM single file  |
  | system (spawn, render)    |   | Output: dist/game.bundle  |
  +---------------------------+   +---------------------------+

  STEP 5: SERVE                    STEP 6: EVAL
  $ game-studio serve              $ game-studio eval
  +---------------------------+   +---------------------------+
  | HTTP server :8080         |   | POST /api/eval            |
  | Serves index.html         |   |   { spec, telemetry }     |
  | Loads game.bundle.js      |   | Claude analyzes quality   |
  | Play in browser           |   | Returns score, bugs, fix  |
  +---------------------------+   +---------------------------+

  STEP 7: FIX                      STEP 8: PUBLISH
  $ game-studio eval --fix         $ game-studio publish
  +---------------------------+   +---------------------------+
  | If score < 80:            |   | gh repo create (if new)   |
  |   Apply fixed_spec        |   | Push via GitHub API:      |
  |   Rebuild game.js         |   |   game.js                 |
  | Else:                     |   |   dist/game.bundle.js     |
  |   Pass! Ship it.          |   |   index.html, README.md   |
  +---------------------------+   +---------------------------+
""")

pdf.add_page()
pdf.diagram_box("Module Usage by Game Type", """
                    core  ecs   grid  render  board  input  ai
                    ----  ---   ----  ------  -----  -----  --
  Tetris            [X]   [X]   [X]   [X]     [ ]    [X]   [ ]
  Snake             [X]   [X]   [X]   [X]     [ ]    [X]   [ ]
  Chess             [X]   [X]   [ ]   [X]     [X]    [X]   [ ]
  Ludo              [X]   [X]   [ ]   [X]     [ ]    [X]   [X]
  2048              [X]   [X]   [X]   [X]     [ ]    [X]   [ ]
  Minesweeper       [X]   [X]   [X]   [X]     [ ]    [X]   [ ]
  Pong              [X]   [X]   [ ]   [X]     [ ]    [X]   [X]
  Breakout          [X]   [X]   [X]   [X]     [ ]    [X]   [ ]
  Solitaire         [X]   [X]   [ ]   [X]     [ ]    [X]   [ ]
  Roguelike         [X]   [X]   [X]   [X]     [ ]    [X]   [ ]
  Tower Defense     [X]   [X]   [ ]   [X]     [ ]    [X]   [ ]
  Battleship        [X]   [X]   [X]   [X]     [ ]    [X]   [X]
  ---               ---   ---   ---   ---     ---    ---   ---
  Used by           29    29    ~15   29      ~5     29    ~4
""")

pdf.add_page()
pdf.diagram_box("Feedback Loop Between Game Development and SDK", """
  +------------------+                      +------------------+
  |  Developer       |                      | Game Factory     |
  |  writes game.js  |                      | Web UI generates |
  |  (Path 2)        |                      | games (Path 1)   |
  +--------+---------+                      +--------+---------+
           |                                         |
           v                                         v
  +--------------------------------------------------+
  |                game-studio eval                   |
  |                (or web UI eval)                   |
  +-------------------+------------------------------+
                      |
            +---------+---------+
            |                   |
            v                   v
  +-----------------+  +------------------+
  | Score >= 80     |  | Score < 80       |
  | PASS            |  | Bugs found       |
  +-----------------+  +--------+---------+
                                |
                     +----------+----------+
                     |                     |
                     v                     v
           +------------------+  +------------------+
           | Bug in game.js   |  | Bug in @engine   |
           | Developer fixes  |  | (Compiler limit) |
           +------------------+  +--------+---------+
                                          |
                                          v
                                +------------------+
                                | Filed as issue   |
                                | on game-factory  |
                                | repository       |
                                +--------+---------+
                                         |
                                         v
                                +------------------+
                                | @engine SDK      |
                                | updated with     |
                                | fix/improvement  |
                                +--------+---------+
                                         |
                                         v
                                +------------------+
                                | ALL games        |
                                | benefit via      |
                                | pull-sdk update  |
                                +------------------+
""")

pdf.add_page()
pdf.diagram_box("Canvas Rendering Architecture", """
  +--------------------------------------------------------------+
  |  Browser Canvas                                              |
  |                                                              |
  |  +------------------------------------------+  +---------+  |
  |  |  Game Area                               |  |  HUD    |  |
  |  |  (offsetX, offsetY)                      |  |         |  |
  |  |                                          |  | Score   |  |
  |  |  Grid Mode:                              |  | Level   |  |
  |  |    width * cellSize pixels               |  | Lines   |  |
  |  |    height * cellSize pixels              |  | Next    |  |
  |  |    Cells at (gx*cell, gy*cell)           |  | Piece   |  |
  |  |                                          |  |         |  |
  |  |  Custom Mode:                            |  | (180px  |  |
  |  |    canvasWidth x canvasHeight pixels      |  |  wide)  |  |
  |  |    Pixel coordinates (cx, cy)            |  |         |  |
  |  |                                          |  |         |  |
  |  +------------------------------------------+  +---------+  |
  |                                                              |
  |  Render Layers:                                              |
  |    1. clearCanvas(background)                                |
  |    2. drawGridBoard / custom background                      |
  |    3. drawPieceCells / drawToken (game objects)               |
  |    4. drawHUD (score, info)                                  |
  |    5. drawGameOver (overlay, if applicable)                  |
  +--------------------------------------------------------------+

  Grid Coordinate System:       Pixel Coordinate System:
  (0,0) (1,0) (2,0)            (55,30)  (95,30)  (135,30)
  (0,1) (1,1) (2,1)   --->     (55,70)  (95,70)  (135,70)
  (0,2) (1,2) (2,2)            (55,110) (95,110) (135,110)
                                each cell = cellSize pixels
""")

pdf.add_page()
pdf.diagram_box("File Structure of a Game Project", """
  my-game/
  |
  +-- game.js                  # Game source (TypeScript/JS DSL)
  |                            # imports from @engine/*
  |
  +-- game-studio.json         # Project configuration
  |                            # { name, factory, github, projectId }
  |
  +-- index.html               # Playable HTML page
  |                            # <script type="module" src="dist/game.bundle.js">
  |
  +-- engine/                  # @engine SDK (downloaded via pull-sdk)
  |   +-- core.js              #   defineGame, component, resource, system
  |   +-- ecs.js               #   World re-export
  |   +-- ecs/
  |   |   +-- index.js         #   World class (ECS runtime)
  |   +-- grid.js              #   Grid mechanics (rotate, collide, etc.)
  |   +-- render.js            #   Canvas drawing utilities
  |   +-- board.js             #   Board game logic
  |   +-- input.js             #   Input consumption helpers
  |   +-- ai.js                #   AI decision-making
  |
  +-- dist/                    # Build output
  |   +-- game.bundle.js       #   Bundled standalone game
  |
  +-- .eval-history.json       # Eval score history (auto-generated)
""")

pdf.output(os.path.join(os.path.dirname(__file__), "ch06.pdf"))
print("ch06.pdf generated")
