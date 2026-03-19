#!/usr/bin/env python3
"""Chapter 8: API Reference"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from book_styles import BookPDF, ACCENT_BLUE, ACCENT_GREEN, ACCENT_ORANGE

pdf = BookPDF("API Reference")

pdf.chapter_cover(8, "API Reference", "Complete Engine API Documentation")

pdf.add_page()
pdf.section_title("@engine/core API")

pdf.section_title("defineGame(config)", level=2)
pdf.body_text("Creates a new game instance. Returns a game object with registration methods.")
pdf.table(
    ["Parameter", "Type", "Required", "Description"],
    [
        ["config.display.type", "string", "Yes", "'grid' or 'custom'"],
        ["config.display.width", "number", "Grid", "Grid columns"],
        ["config.display.height", "number", "Grid", "Grid rows"],
        ["config.display.cellSize", "number", "Grid", "Pixels per cell"],
        ["config.display.background", "string", "Yes", "CSS color string"],
        ["config.display.canvasWidth", "number", "Custom", "Canvas pixel width"],
        ["config.display.canvasHeight", "number", "Custom", "Canvas pixel height"],
        ["config.display.offsetX", "number", "Custom", "Game area X offset"],
        ["config.display.offsetY", "number", "Custom", "Game area Y offset"],
        ["config.input", "object", "Yes", "Action-to-keys mapping"],
    ],
    col_widths=[55, 25, 25, 85]
)

pdf.section_title("game.component(name, defaults)", level=2)
pdf.body_text("Registers a component schema. Components are data bags attached to entities.")
pdf.table(
    ["Parameter", "Type", "Description"],
    [
        ["name", "string", "Component name (e.g., 'Position')"],
        ["defaults", "object", "Default field values (e.g., { x: 0, y: 0 })"],
    ],
    col_widths=[40, 30, 120]
)

pdf.section_title("game.resource(name, defaults)", level=2)
pdf.body_text("Registers a singleton resource shared across all systems.")
pdf.table(
    ["Parameter", "Type", "Description"],
    [
        ["name", "string", "Resource name (e.g., 'state')"],
        ["defaults", "object", "Initial values (e.g., { score: 0, gameOver: false })"],
    ],
    col_widths=[40, 30, 120]
)

pdf.section_title("game.system(name, fn)", level=2)
pdf.body_text("Registers a system function. Systems execute in registration order each frame.")
pdf.table(
    ["Parameter", "Type", "Description"],
    [
        ["name", "string", "System name (e.g., 'render')"],
        ["fn", "function(world, dt)", "System function. Receives World and delta time (ms)"],
    ],
    col_widths=[40, 50, 100]
)

# ── World API ──
pdf.section_title("World API (inside systems)", level=1)

pdf.section_title("Entity Management", level=2)
pdf.table(
    ["Method", "Returns", "Description"],
    [
        ["world.createEntity()", "number (eid)", "Create a new entity, returns its ID"],
        ["world.destroyEntity(eid)", "void", "Remove entity and all its components"],
    ],
    col_widths=[55, 40, 95]
)

pdf.section_title("Component Operations", level=2)
pdf.table(
    ["Method", "Returns", "Description"],
    [
        ["world.addComponent(eid, name, data)", "void", "Attach component to entity"],
        ["world.getComponent(eid, name)", "object", "Get component data (mutable)"],
        ["world.removeComponent(eid, name)", "void", "Detach component from entity"],
        ["world.query(name)", "number[]", "All entity IDs with this component"],
    ],
    col_widths=[70, 30, 90]
)

pdf.section_title("Resource Operations", level=2)
pdf.table(
    ["Method", "Returns", "Description"],
    [
        ["world.getResource(name)", "any", "Get singleton resource value"],
        ["world.setResource(name, value)", "void", "Replace singleton resource"],
    ],
    col_widths=[65, 25, 100]
)

pdf.section_title("Event Operations", level=2)
pdf.table(
    ["Method", "Returns", "Description"],
    [
        ["world.emit(event, data)", "void", "Emit frame-scoped event"],
        ["world.on(event, handler)", "void", "Listen for event this frame"],
        ["world.clearEvents()", "void", "Clear all events (auto per tick)"],
    ],
    col_widths=[60, 25, 105]
)

pdf.section_title("Lifecycle", level=2)
pdf.table(
    ["Method", "Returns", "Description"],
    [
        ["world.tick(deltaTime)", "void", "Advance one frame, run systems"],
    ],
    col_widths=[60, 25, 105]
)

# ── @engine/grid API ──
pdf.add_page()
pdf.section_title("@engine/grid API", level=1)

pdf.table(
    ["Function", "Parameters", "Returns", "Description"],
    [
        ["rotateShape", "(shape, times)", "number[][]", "Rotate 2D array 90deg * times"],
        ["collides", "(shape, x, y, grid)", "boolean", "Shape overlaps occupied cells?"],
        ["clearLines", "(grid, rows)", "void", "Remove rows, compact grid down"],
        ["ghostY", "(shape, x, startY, grid)", "number", "Y position where piece lands"],
        ["lockCells", "(grid, shape, x, y, val)", "void", "Write piece cells into grid"],
        ["wrapPosition", "(x, y, w, h)", "{x, y}", "Wrap coords to grid bounds"],
        ["selfCollides", "(segments)", "boolean", "Snake segment overlaps itself?"],
        ["randomFreePos", "(grid)", "{x, y}", "Random unoccupied cell position"],
    ],
    col_widths=[35, 55, 30, 70]
)

# ── @engine/render API ──
pdf.section_title("@engine/render API", level=1)

pdf.section_title("Canvas Operations", level=2)
pdf.table(
    ["Function", "Parameters", "Description"],
    [
        ["clearCanvas", "(ctx, color)", "Fill canvas with solid color"],
        ["drawBorder", "(ctx, x, y, w, h, color)", "Draw rectangle outline"],
    ],
    col_widths=[40, 60, 90]
)

pdf.section_title("Grid Drawing", level=2)
pdf.table(
    ["Function", "Parameters", "Description"],
    [
        ["drawGridBoard", "(ctx, ox, oy, cell, w, h, color)", "Draw grid lines"],
        ["drawPieceCells", "(ctx, ox, oy, cell, gx, gy, col)", "Draw one colored cell"],
        ["drawCheckerboard", "(ctx, ox, oy, cell, w, h)", "Alternating grid (chess)"],
        ["drawSnake", "(ctx, ox, oy, cell, segments, col)", "Draw snake segments"],
        ["drawFood", "(ctx, ox, oy, cell, gx, gy, col)", "Draw food item"],
        ["drawEntitiesAsText", "(ctx, ents, ox, oy, cell)", "Unicode text in cells"],
        ["drawHighlight", "(ctx, ox, oy, cell, gx, gy, col)", "Highlight cell"],
    ],
    col_widths=[45, 70, 75]
)

pdf.section_title("Pixel Drawing", level=2)
pdf.table(
    ["Function", "Parameters", "Description"],
    [
        ["drawToken", "(ctx, cx, cy, r, color, opts)", "Circle with optional label"],
        ["drawDice", "(ctx, x, y, size, value, opts)", "Dice face with dots"],
        ["drawSquare", "(ctx, x, y, w, h, color, stroke)", "Filled/stroked rectangle"],
    ],
    col_widths=[40, 65, 85]
)

pdf.section_title("HUD & Overlays", level=2)
pdf.table(
    ["Function", "Parameters", "Description"],
    [
        ["drawHUD", "(ctx, state, ox, cw, oy, opts)", "Score, level, custom fields"],
        ["drawGameOver", "(ctx, ox, oy, w, h, opts)", "Semi-transparent overlay text"],
    ],
    col_widths=[40, 60, 90]
)

# ── @engine/board API ──
pdf.section_title("@engine/board API", level=1)
pdf.table(
    ["Function", "Parameters", "Returns", "Description"],
    [
        ["buildBoardMap", "(initialPieces)", "Map", "Create board representation"],
        ["isLegalMove", "(from, to, piece, board)", "boolean", "Validate piece movement"],
        ["isPathClear", "(from, to, board)", "boolean", "No pieces blocking path"],
    ],
    col_widths=[35, 55, 25, 75]
)

# ── @engine/input API ──
pdf.section_title("@engine/input API", level=1)
pdf.table(
    ["Function", "Parameters", "Returns", "Description"],
    [
        ["consumeAction", "(inputState, action)", "boolean", "True once per press"],
        ["moveCursor", "(inputState)", "{x, y}", "Arrow key direction -1/0/1"],
    ],
    col_widths=[35, 55, 25, 75]
)

# ── @engine/ai API ──
pdf.section_title("@engine/ai API", level=1)
pdf.table(
    ["Function", "Parameters", "Returns", "Description"],
    [
        ["pickBestMove", "(moves, evaluator)", "move", "Highest-scoring move"],
        ["pickWeightedMove", "(moves, evaluator)", "move", "Probabilistic selection"],
        ["pickRandomMove", "(moves)", "move", "Uniform random choice"],
        ["compositeEvaluator", "(evaluators)", "function", "Combine scoring strategies"],
    ],
    col_widths=[42, 52, 25, 71]
)

# ── CLI API ──
pdf.add_page()
pdf.section_title("Game Studio CLI API", level=1)
pdf.body_text(
    "Each CLI command is implemented as an async function exported from lib/*.js. "
    "They receive a context object with args, cwd, config, and factoryUrl."
)

pdf.code_block("""// Common function signature for all commands:
export default async function commandName({
  args,        // string[] - CLI arguments after command name
  cwd,         // string - Current working directory
  config,      // object - Parsed game-studio.json
  factoryUrl,  // string - Game Factory server URL
}) { ... }""", "CLI Command Interface")

pdf.table(
    ["Command Module", "Exports", "Dependencies"],
    [
        ["lib/init.js", "init({ args, cwd })", "fs, path"],
        ["lib/pull-sdk.js", "pullSdk({ cwd, factoryUrl })", "fs, fetch"],
        ["lib/build.js", "build({ args, cwd, factoryUrl })", "fs, esbuild-wasm"],
        ["lib/serve.js", "serve({ args, cwd })", "http, fs"],
        ["lib/eval.js", "evalGame({ args, cwd, config, factoryUrl })", "fs, fetch"],
        ["lib/fix.js", "fix({ args, cwd, config, factoryUrl })", "fetch"],
        ["lib/publish.js", "publish({ args, cwd, config })", "fs, child_process (gh)"],
        ["lib/info.js", "info({ cwd, config, factoryUrl })", "fs"],
    ],
    col_widths=[38, 75, 77]
)

# ── Server API ──
pdf.section_title("Game Factory Server API", level=1)
pdf.table(
    ["Endpoint", "Method", "Request Body", "Response"],
    [
        ["/api/sdk", "GET", "(none)", "{ modules, version }"],
        ["/api/compile", "POST", "{ source }", "{ code } or { errors }"],
        ["/api/eval", "POST", "{ spec, telemetry }", "{ score, analysis, bugs, fixed_spec }"],
        ["/api/generate", "POST", "{ prompt }", "{ spec }"],
        ["/api/projects/:id/eval", "POST", "{ spec, sourceCode }", "{ score, ... }"],
        ["/api/projects/:id/fix-issues", "POST", "{ } (?apply=true)", "{ fixes, applied }"],
    ],
    col_widths=[52, 18, 55, 65]
)

pdf.output(os.path.join(os.path.dirname(__file__), "ch07.pdf"))
print("ch07.pdf generated")
