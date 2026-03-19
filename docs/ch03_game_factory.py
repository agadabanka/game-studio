#!/usr/bin/env python3
"""Chapter 3: Game Factory Server"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from book_styles import BookPDF, ACCENT_BLUE, ACCENT_GREEN, ACCENT_ORANGE, ACCENT_PURPLE

pdf = BookPDF("Game Factory Server")

pdf.chapter_cover(3, "Game Factory Server", "APIs, Compilation & Evaluation Backend")

pdf.add_page()
pdf.section_title("Overview")
pdf.body_text(
    "Game Factory is the server-side backend that powers both the Web UI (Path 1) and the "
    "CLI (Path 2). It hosts the @engine SDK modules, provides compilation via esbuild-wasm, "
    "quality evaluation via Claude, game generation from natural language, and GitHub issue "
    "auto-fixing. It is the shared backbone that makes both creation paths work."
)

pdf.section_title("API Endpoints", level=1)

pdf.section_title("GET /api/sdk", level=2)
pdf.body_text(
    "Returns all @engine SDK modules as a JSON object. Used by game-studio pull-sdk to "
    "download the engine locally for offline development."
)
pdf.code_block("""// Response format:
{
  "modules": {
    "core.js": "export function defineGame(config) { ... }",
    "ecs.js": "export class World { ... }",
    "grid.js": "export function rotateShape(...) { ... }",
    "render.js": "export function clearCanvas(...) { ... }",
    "board.js": "export function buildBoardMap(...) { ... }",
    "input.js": "export function consumeAction(...) { ... }",
    "ai.js": "export function pickBestMove(...) { ... }",
    "ecs/index.js": "// ECS runtime World class ..."
  },
  "version": "1.0.0"
}""", "GET /api/sdk Response")

pdf.section_title("POST /api/compile", level=2)
pdf.body_text(
    "Compiles game.js source into a standalone bundle using esbuild-wasm on the server. "
    "Used as a fallback when local building fails."
)
pdf.code_block("""// Request:
{ "source": "import { defineGame } from '@engine/core'; ..." }

// Response (success):
{ "code": "// bundled JavaScript output..." }

// Response (error):
{ "errors": ["Module not found: @engine/custom"] }""", "POST /api/compile")

pdf.section_title("POST /api/eval", level=2)
pdf.body_text(
    "Evaluates game quality using Claude AI. Analyzes code quality, completeness, ECS "
    "pattern adherence, and game mechanics correctness."
)
pdf.code_block("""// Request:
{
  "spec": { "_tsSource": "game source code...", "_specType": "ts" },
  "telemetry": { "source": "game-studio-cli", "timestamp": 1710864000 }
}

// Response:
{
  "score": 85,           // 0-100, 80+ is passing
  "analysis": "Clean ECS structure. Good separation of concerns...",
  "bugs": [              // Array of bug descriptions
    "Ghost piece not rendered when at bottom row",
    "Score not incrementing on soft drop"
  ],
  "fixed_spec": {        // Only if score < 80
    "_tsSource": "// corrected game source...",
    "_specType": "ts"
  },
  "vision_alignment": "Matches expected behavior for Tetris clone"
}""", "POST /api/eval")

pdf.section_title("POST /api/generate", level=2)
pdf.body_text(
    "Path 1 only: Generates a game JSON spec from a natural language description. "
    "Uses Claude to translate user intent into a structured game specification."
)
pdf.code_block("""// Request:
{ "prompt": "Make a chess game with a dark theme" }

// Response:
{ "spec": { /* JSON game specification */ } }""", "POST /api/generate")

pdf.section_title("POST /api/projects/:id/fix-issues", level=2)
pdf.body_text(
    "Fetches open GitHub issues for a project, uses Claude to classify them as fixable "
    "or 'compiler limitations', and optionally auto-applies fixes to the game source. "
    "Compiler limitations are filed back on the game-factory repo to improve the SDK."
)
pdf.code_block("""// Request:
POST /api/projects/abc123/fix-issues?apply=true
{}

// Response:
{
  "fixes": [
    { "issue_number": 1, "fixable": true, "description": "Score reset on restart" },
    { "issue_number": 2, "fixable": false, "description": "COMPILER LIMITATION: ..." }
  ],
  "applied": 1,
  "skipped": 1
}""", "POST /api/projects/:id/fix-issues")

pdf.section_title("Server Architecture", level=1)
pdf.diagram_box("Game Factory Server Components", """
+------------------------------------------------------------------+
|                     GAME FACTORY SERVER                          |
|                                                                  |
|  +------------------+    +------------------+    +-----------+   |
|  |  Express/Node.js |    |  esbuild-wasm    |    |  Claude   |   |
|  |  HTTP Server     |    |  Compiler Engine  |    |  AI API   |   |
|  +--------+---------+    +--------+---------+    +-----+-----+   |
|           |                       |                    |         |
|           v                       v                    v         |
|  +------------------+    +------------------+    +-----------+   |
|  |  Route Handlers  |    |  Virtual FS      |    |  Eval     |   |
|  |  /api/sdk        |--->|  @engine/* alias  |    |  Scoring  |   |
|  |  /api/compile    |--->|  resolution       |    |  0-100    |   |
|  |  /api/eval       |--->|  Bundle output    |    |           |   |
|  |  /api/generate   |    |                  |    |  Bug      |   |
|  |  /api/fix-issues |    |                  |    |  Detection|   |
|  +------------------+    +------------------+    +-----------+   |
|           |                                            |         |
|           v                                            v         |
|  +------------------+                        +--------------+    |
|  |  @engine SDK     |                        |  GitHub API  |    |
|  |  Module Storage  |                        |  Issue Mgmt  |    |
|  |  core.js, etc.   |                        |  Repo Ops    |    |
|  +------------------+                        +--------------+    |
+------------------------------------------------------------------+""")

pdf.section_title("Compilation Pipeline", level=1)
pdf.body_text(
    "When a game is compiled (either locally via game-studio build or remotely via "
    "/api/compile), the following pipeline executes:"
)
pdf.bullet_list([
    "1. Read game.js source code (the developer's game logic)",
    "2. Load all @engine/* modules into a virtual filesystem map",
    "3. Initialize esbuild-wasm (WebAssembly-based bundler)",
    "4. Register the virtual plugin to resolve @engine/* imports",
    "5. Handle nested imports (e.g., ./ecs.js within engine modules)",
    "6. Bundle everything into a single ESM file for the browser",
    "7. Output dist/game.bundle.js (minified, self-contained)",
])

pdf.section_title("Quality Scoring Criteria", level=1)
pdf.body_text("The eval system scores games on multiple dimensions:")

pdf.table(
    ["Criterion", "Weight", "Description"],
    [
        ["ECS Pattern", "High", "Correct use of components, resources, systems"],
        ["Completeness", "High", "All game mechanics implemented and functional"],
        ["Code Quality", "Medium", "Clean code, no dead code, proper structure"],
        ["Input Handling", "Medium", "Responsive controls, proper action consumption"],
        ["Rendering", "Medium", "Canvas drawing correct, HUD displayed properly"],
        ["Game Logic", "High", "Rules correct (scoring, win/loss, collisions)"],
        ["Restart", "Low", "Game restarts cleanly without state leaks"],
        ["Edge Cases", "Low", "Boundary conditions handled (top of grid, etc.)"],
    ],
    col_widths=[40, 25, 125]
)

pdf.info_box("Scoring Threshold",
    "A score of 80 or above is considered passing. Games scoring below 80 trigger "
    "automatic fix suggestions. Games scoring below 60 likely have fundamental issues "
    "with game logic or ECS structure.")

pdf.output(os.path.join(os.path.dirname(__file__), "ch03.pdf"))
print("ch03.pdf generated")
