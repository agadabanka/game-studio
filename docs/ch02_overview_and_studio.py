#!/usr/bin/env python3
"""Chapter 2: System Overview + Game Studio CLI"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from book_styles import BookPDF, ACCENT_BLUE, ACCENT_GREEN, ACCENT_ORANGE, TEXT_PRIMARY, TEXT_SECONDARY

pdf = BookPDF("System Overview & Game Studio CLI")

# ── CHAPTER 1: SYSTEM OVERVIEW ──────────────────────────
pdf.chapter_cover(1, "System Overview", "The Two-Path Game Creation System")

pdf.add_page()
pdf.section_title("What is Game Studio?")
pdf.body_text(
    "Game Studio is a CLI-based development environment for creating high-quality ECS "
    "(Entity-Component-System) games. It is the developer-focused companion to Game Factory, "
    "a web-based UI that lets non-technical users describe games in natural language. Together, "
    "they form a two-path system that shares a common engine SDK, evaluation pipeline, and "
    "GitHub-based publishing workflow."
)

pdf.section_title("The Two Paths", level=2)
pdf.body_text(
    "Path 1: User -> Game Factory (Web UI) -> Game on GitHub. A non-technical user describes "
    "a game in natural language. Game Factory uses Claude to generate a JSON spec, runs an eval "
    "loop that scores quality, files bugs, and auto-fixes. The game is then published to GitHub."
)
pdf.body_text(
    "Path 2: Developer -> Claude Code -> game-studio CLI -> Game on GitHub. A developer writes "
    "game.js using the @engine SDK with help from Claude Code. The CLI bundles, evaluates, and "
    "publishes. Eval bugs feed back into the common libraries, and battle-hardened libraries "
    "improve Path 1 quality."
)

pdf.info_box("Key Insight", "Both paths share the same @engine SDK, eval system, and GitHub integration. Improvements discovered in Path 2 (developer) directly improve Path 1 (web UI) game quality.")

pdf.section_title("Shared Infrastructure", level=2)
pdf.bullet_list([
    "@engine SDK: Common game engine modules (core, grid, render, board, input, ai)",
    "Eval System: Claude-powered quality scoring (0-100) with bug detection",
    "GitHub Integration: Publish games as standalone repositories",
    "Feedback Loop: Eval bugs classified as 'compiler limitations' improve the SDK",
])

pdf.diagram_box("System Architecture Overview", """
+----------------------------------------------------------------------+
|                      GAME CREATION SYSTEM                            |
+--------------------------------+-------------------------------------+
|                                |                                     |
|   PATH 1: Web UI              |   PATH 2: CLI (game-studio)         |
|                                |                                     |
|   +-------------+             |   +---------------------------+     |
|   |  User       |             |   |  Developer                |     |
|   |  (Browser)  |             |   |  (Claude Code terminal)   |     |
|   +------+------+             |   +-----------+---------------+     |
|          |                     |               |                     |
|          | "Make a             |               | game-studio init    |
|          |  chess game"        |               | game-studio build   |
|          v                     |               v                     |
|   +-------------+             |   +---------------------------+     |
|   | Game Factory|             |   |  game.js                  |     |
|   |  Web UI     |             |   |  (TypeScript source)      |     |
|   +------+------+             |   |  using @engine/* SDK      |     |
|          |                     |   +---------------------------+     |
+----------+---------------------+---------------+---------------------+
|                                                                      |
|                    GAME FACTORY SERVER                                |
|                    (Common Backend)                                   |
|                                                                      |
|   /api/sdk     /api/compile     /api/eval     /api/generate          |
|   (modules)    (esbuild)        (Claude QA)   (Claude LLM)          |
+----------------------------------------------------------------------+
|                                                                      |
|                    @ENGINE SDK (Common Libraries)                     |
|   core.js   grid.js   render.js   board.js   input.js   ai.js      |
+----------------------------------------------------------------------+""")

# ── CHAPTER 2: GAME STUDIO CLI ──────────────────────────
pdf.chapter_cover(2, "Game Studio CLI", "Commands, Workflow & Configuration")

pdf.add_page()
pdf.section_title("Overview")
pdf.body_text(
    "Game Studio is a Node.js CLI tool (bin/game-studio.js) that provides a complete "
    "development workflow: scaffolding, SDK management, building, serving, evaluating, "
    "fixing, and publishing games. It communicates with the Game Factory server for "
    "compilation, evaluation, and issue management."
)

pdf.section_title("Commands Reference", level=2)
pdf.table(
    ["Command", "Description", "Key File"],
    [
        ["init <name>", "Scaffold new game project with template", "lib/init.js"],
        ["pull-sdk", "Download @engine SDK from Game Factory", "lib/pull-sdk.js"],
        ["build", "Bundle game.js via esbuild-wasm", "lib/build.js"],
        ["serve", "Start local dev server (port 8080)", "lib/serve.js"],
        ["eval", "AI quality evaluation (score 0-100)", "lib/eval.js"],
        ["eval --fix", "Eval + auto-apply fixes if score < 80", "lib/eval.js"],
        ["fix", "Analyze open GitHub issues (dry run)", "lib/fix.js"],
        ["fix --apply", "Apply fixes and close issues", "lib/fix.js"],
        ["publish", "Push game to GitHub via gh CLI", "lib/publish.js"],
        ["info", "Show project config and architecture", "lib/info.js"],
    ],
    col_widths=[40, 85, 65]
)

pdf.section_title("The Development Workflow", level=1)
pdf.body_text(
    "The game-studio workflow follows a clear progression from scaffolding to publishing. "
    "Each step builds on the previous one."
)

# Step-by-step workflow
steps = [
    ("Step 1: Init", "game-studio init my-game",
     "Creates game.js (template with defineGame, components, resources, systems), "
     "game-studio.json (config), index.html (playable page), engine/ and dist/ directories."),
    ("Step 2: Pull SDK", "game-studio pull-sdk",
     "Fetches engine modules from Game Factory's /api/sdk endpoint. Response contains "
     "{ modules: { 'core.js': '...', 'grid.js': '...' }, version: '1.0.0' }. Each module "
     "is written to the engine/ directory for local bundling."),
    ("Step 3: Develop", "Edit game.js with @engine/* imports",
     "Developer writes game logic using the ECS pattern: define components (data), "
     "resources (singletons), and systems (behavior). Claude Code assists with authoring."),
    ("Step 4: Build", "game-studio build",
     "Uses esbuild-wasm locally to bundle game.js with engine modules into dist/game.bundle.js. "
     "A custom virtual plugin resolves @engine/* imports to local engine/ files. Falls back to "
     "remote /api/compile if local build fails."),
    ("Step 5: Serve", "game-studio serve",
     "Starts HTTP server on port 8080. Serves index.html which loads dist/game.bundle.js. "
     "Developer can play and test in browser."),
    ("Step 6: Eval", "game-studio eval",
     "Sends game source to Game Factory's /api/eval. Claude analyzes code quality, "
     "completeness, ECS pattern adherence. Returns score (0-100, 80+ is passing), "
     "analysis, bugs list, and optionally a fixed version."),
    ("Step 7: Fix", "game-studio eval --fix",
     "If score < 80, applies Claude's fixed_spec to game.js automatically. Developer "
     "then rebuilds. Alternatively, game-studio fix analyzes GitHub issues and auto-fixes."),
    ("Step 8: Publish", "game-studio publish",
     "Uses GitHub CLI (gh) to create repo if needed, then pushes game.js, dist/game.bundle.js, "
     "index.html, spec.json, and auto-generated README.md via the GitHub Contents API."),
]

for title, cmd, desc in steps:
    pdf.section_title(title, level=2)
    pdf.code_block(cmd)
    pdf.body_text(desc)

pdf.section_title("Configuration", level=1)
pdf.body_text("Each game project has a game-studio.json in its root:")

pdf.code_block("""{
  "name": "my-game",
  "factory": "http://localhost:3000",
  "github": {
    "owner": "your-username",
    "repo": "my-game"
  },
  "engine": {
    "version": "latest"
  },
  "projectId": "optional-for-eval-and-fix"
}""", "game-studio.json")

pdf.section_title("Build System Deep Dive", level=1)
pdf.body_text(
    "The build system uses esbuild-wasm (v0.25.0), a WebAssembly-based JavaScript bundler "
    "that runs entirely offline. A custom 'game-studio-virtual' plugin maps @engine/* imports "
    "to local engine/ files via a virtual filesystem."
)

pdf.code_block("""// Virtual plugin resolves @engine/* imports
const virtualPlugin = {
  name: 'game-studio-virtual',
  setup(build) {
    build.onResolve({ filter: /^@engine/ }, (args) => {
      return { path: args.path, namespace: 'engine-virtual' };
    });
    build.onLoad({ filter: /.*/, namespace: 'engine-virtual' }, (args) => {
      return { contents: virtualFiles[args.path], loader: 'js' };
    });
    // Also resolves ./ecs.js relative imports within engine modules
    build.onResolve({ filter: /^\\.\/ecs\\.js$/ }, () => {
      return { path: 'ecs-runtime', namespace: 'engine-virtual' };
    });
  }
};""", "lib/build.js - Virtual Plugin")

pdf.section_title("Eval System Deep Dive", level=1)
pdf.body_text(
    "The eval system sends game source to Claude for AI-powered quality assessment. "
    "It supports project-scoped evaluation (with projectId) and simple evaluation."
)
pdf.body_text(
    "Results include: score (0-100, 80+ is good), analysis text, bugs array, "
    "vision_alignment assessment, and optionally a fixed_spec with corrected source. "
    "History is saved to .eval-history.json for tracking quality over time."
)

pdf.section_title("Feedback Loop", level=2)
pdf.diagram_box("Quality Feedback Cycle", """
  Developer writes game          Game passes eval
  using @engine SDK              (score >= 80)
        |                              |
        v                              v
  game-studio eval              Patterns validated --------+
        |                                                  |
        v                                                  |
  Score < 80                                               |
  Bugs found                                               |
        |                                                  |
        +-- Bug in game.js? --> Developer fixes            |
        |                                                  |
        +-- Bug in @engine? --> Compiler bug filed ---+    |
                                on game-factory repo  |    |
                                                      v    v
                                             @engine SDK updated
                                             with fix/improvement
                                                      |
                                                      v
                                             All games benefit
                                             (pull-sdk to update)""")

pdf.output(os.path.join(os.path.dirname(__file__), "ch02.pdf"))
print("ch02.pdf generated")
