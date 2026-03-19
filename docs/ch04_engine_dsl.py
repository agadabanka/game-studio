#!/usr/bin/env python3
"""Chapter 4: The Engine SDK + Chapter 5: The DSL"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from book_styles import BookPDF, ACCENT_BLUE, ACCENT_GREEN, ACCENT_ORANGE, ACCENT_PURPLE

pdf = BookPDF("The Engine SDK")

# ── CHAPTER 4: ENGINE SDK ──────────────────────────
pdf.chapter_cover(4, "The Engine SDK", "ECS Architecture & Module Reference")

pdf.add_page()
pdf.section_title("Architecture: Entity-Component-System")
pdf.body_text(
    "The @engine SDK is built on the Entity-Component-System (ECS) pattern, a data-oriented "
    "design that favors composition over inheritance. Instead of class hierarchies, game objects "
    "are composed from reusable data components, and behavior is defined in systems that operate "
    "on entities matching specific component queries."
)

pdf.section_title("Core Concepts", level=2)
pdf.table(
    ["Concept", "What It Is", "Example"],
    [
        ["Entity", "A numeric ID representing a game object", "Player, enemy, bullet"],
        ["Component", "Named data bag attached to entities", "Position { x, y }"],
        ["Resource", "Singleton shared across all systems", "state { score, level }"],
        ["System", "Function that runs each frame", "physics, render, input"],
        ["World", "Container for all entities and systems", "Created by defineGame()"],
    ],
    col_widths=[30, 80, 80]
)

pdf.section_title("Module Overview", level=1)
pdf.diagram_box("SDK Module Dependency Graph", """
game.js (your game)
  |
  +-- @engine/core    --> defineGame, component, resource, system, start
  |     +-- @engine/ecs  --> World (createEntity, addComponent, query, tick)
  |
  +-- @engine/grid    --> rotateShape, collides, clearLines, wrapPosition, ...
  |
  +-- @engine/render  --> drawGridBoard, drawPieceCells, drawSnake, drawHUD, ...
  |
  +-- @engine/board   --> buildBoardMap, isLegalMove, isPathClear (board games)
  |
  +-- @engine/input   --> consumeAction, moveCursor
  |
  +-- @engine/ai      --> pickBestMove, pickWeightedMove, pickRandomMove
""")

# ── @engine/core ──
pdf.section_title("@engine/core.js", level=1)
pdf.body_text(
    "The core module is the entry point for every game. It provides defineGame() which "
    "creates a game instance with display configuration and input mapping. The game instance "
    "exposes methods to register components, resources, and systems. Calling start() "
    "initializes the canvas, creates the World, and begins the game loop."
)

pdf.section_title("defineGame(config)", level=3)
pdf.code_block("""const game = defineGame({
  display: {
    type: 'grid',           // 'grid' or 'custom'
    width: 10,              // Grid columns (or canvasWidth for custom)
    height: 20,             // Grid rows (or canvasHeight for custom)
    cellSize: 40,           // Pixels per cell (grid mode only)
    background: '#111',     // Canvas background color
    // Custom mode only:
    canvasWidth: 720,       // Explicit pixel width
    canvasHeight: 560,      // Explicit pixel height
    offsetX: 55,            // X offset for game area
    offsetY: 30,            // Y offset for game area
  },
  input: {
    up: { keys: ['ArrowUp', 'w'] },
    down: { keys: ['ArrowDown', 's'] },
    left: { keys: ['ArrowLeft', 'a'] },
    right: { keys: ['ArrowRight', 'd'] },
    action: { keys: [' ', 'Enter'] },
    restart: { keys: ['r', 'R'] },
  },
});""", "Display + Input Configuration")

pdf.section_title("Game Instance Methods", level=3)
pdf.code_block("""// Define a component (data shape for entities)
game.component('Position', { x: 0, y: 0 });
game.component('Velocity', { dx: 0, dy: 0 });
game.component('Piece', { shape: [], rotation: 0 });

// Define a resource (shared singleton)
game.resource('state', { score: 0, level: 1, gameOver: false });
game.resource('_grid', Array(20).fill(null).map(() => Array(10).fill(0)));

// Register a system (runs every frame in order)
game.system('spawn', function(world, dt) { ... });
game.system('input', function(world, dt) { ... });
game.system('physics', function(world, dt) { ... });
game.system('render', function(world, dt) { ... });

// Start the game loop (called by index.html)
export default game;""", "Component, Resource & System Registration")

# ── @engine/ecs ──
pdf.section_title("@engine/ecs (World Runtime)", level=1)
pdf.body_text(
    "The ECS runtime provides the World class that manages entities, components, resources, "
    "and event dispatch. Systems receive the world object and use its API to query and "
    "modify game state."
)

pdf.code_block("""// World API available inside systems:
const eid = world.createEntity();             // Create new entity -> numeric ID
world.addComponent(eid, 'Position', { x: 5, y: 0 });  // Attach component
const pos = world.getComponent(eid, 'Position');       // Get component data
pos.x += 1;                                            // Mutate directly
world.removeComponent(eid, 'Position');                // Remove component

const entities = world.query('Position');      // All entities with Position
const state = world.getResource('state');      // Get singleton resource
world.setResource('state', newState);          // Replace resource

world.emit('lineClear', { rows: [18, 19] });  // Frame-scoped event
world.tick(deltaTime);                         // Advance one frame""", "World API")

pdf.info_box("Frame-Scoped Events",
    "Events emitted via world.emit() are cleared every frame during world.tick(). "
    "They are only useful for single-frame communication between systems. Multi-frame "
    "coordination requires state machine patterns (see Learnings chapter).")

# ── @engine/grid ──
pdf.section_title("@engine/grid.js", level=1)
pdf.body_text(
    "Grid helpers for rectangular grid-based games like Tetris and Snake. Provides "
    "piece rotation, collision detection, line clearing, position wrapping, and more."
)

pdf.table(
    ["Function", "Purpose", "Used By"],
    [
        ["rotateShape(shape, times)", "Rotate 2D array 90 degrees N times", "Tetris"],
        ["collides(shape, x, y, grid)", "Check if piece overlaps occupied cells", "Tetris"],
        ["clearLines(grid, fullRows)", "Remove full rows and compact grid", "Tetris"],
        ["ghostY(shape, x, y, grid)", "Calculate drop destination Y", "Tetris"],
        ["lockCells(grid, shape, x, y, val)", "Lock piece cells into grid", "Tetris"],
        ["wrapPosition(x, y, w, h)", "Wrap coords for toroidal grid", "Snake"],
        ["selfCollides(segments)", "Check if snake hits itself", "Snake"],
        ["randomFreePosition(grid)", "Find empty cell for food", "Snake"],
    ],
    col_widths=[65, 80, 45]
)

# ── @engine/render ──
pdf.section_title("@engine/render.js", level=1)
pdf.body_text(
    "Canvas drawing utilities organized in two layers: grid-coordinate primitives "
    "(for grid-based games) and pixel-coordinate primitives (for custom layouts)."
)

pdf.section_title("Grid Primitives (Layer 1)", level=3)
pdf.table(
    ["Function", "Purpose"],
    [
        ["clearCanvas(ctx, color)", "Fill entire canvas with background color"],
        ["drawBorder(ctx, x, y, w, h, color)", "Draw rectangle border"],
        ["drawGridBoard(ctx, ox, oy, cell, w, h, col)", "Draw grid pattern"],
        ["drawPieceCells(ctx, ox, oy, cell, gx, gy, col)", "Draw single colored cell"],
        ["drawSnake(ctx, ox, oy, cell, segments, col)", "Draw snake as cell sequence"],
        ["drawFood(ctx, ox, oy, cell, gx, gy, col)", "Draw food item"],
        ["drawCheckerboard(ctx, ox, oy, cell, w, h)", "Draw alternating grid (chess)"],
        ["drawEntitiesAsText(ctx, entities, ox, oy, cell)", "Draw unicode text in cells"],
        ["drawHighlight(ctx, ox, oy, cell, gx, gy, col)", "Highlight a cell"],
    ],
    col_widths=[85, 105]
)

pdf.section_title("Pixel Primitives (Layer 2)", level=3)
pdf.table(
    ["Function", "Purpose"],
    [
        ["drawToken(ctx, cx, cy, r, color, opts)", "Circular token with optional label"],
        ["drawDice(ctx, x, y, size, value, opts)", "Dice face with dot pattern"],
        ["drawSquare(ctx, x, y, w, h, color, stroke)", "Arbitrary positioned rectangle"],
    ],
    col_widths=[85, 105]
)

pdf.section_title("HUD & Overlays", level=3)
pdf.table(
    ["Function", "Purpose"],
    [
        ["drawHUD(ctx, state, ox, cw, oy, opts)", "Score, level, custom fields"],
        ["drawGameOver(ctx, ox, oy, w, h, opts)", "Semi-transparent overlay with text"],
    ],
    col_widths=[85, 105]
)

# ── @engine/board ──
pdf.section_title("@engine/board.js", level=1)
pdf.body_text(
    "Board game logic for grid-based board games like Chess. Provides board state "
    "management, move validation, and path checking for sliding pieces."
)
pdf.code_block("""const board = buildBoardMap(initialPieces);  // Create board state
const legal = isLegalMove(from, to, piece, board);  // Validate move
const clear = isPathClear(from, to, board);  // Check sliding path""", "Board API")

pdf.info_box("Chess-Specific Note",
    "board.js is currently chess-specific. It handles piece types (king, queen, rook, "
    "bishop, knight, pawn) with their movement patterns. Track-based games like Ludo "
    "do not use this module. See Learnings chapter for proposed board-track.js split.")

# ── @engine/input ──
pdf.section_title("@engine/input.js", level=1)
pdf.body_text(
    "Input handling helpers for consuming keyboard actions in systems."
)
pdf.code_block("""// In a system:
const input = world.getResource('input');

// Consume an action (returns true once per press)
if (consumeAction(input, 'left')) {
  piece.x -= 1;
}

// Get cursor movement as { x: -1|0|1, y: -1|0|1 }
const cursor = moveCursor(input);
if (cursor.x !== 0 || cursor.y !== 0) {
  selection.x += cursor.x;
  selection.y += cursor.y;
}""", "Input Consumption Pattern")

# ── @engine/ai ──
pdf.section_title("@engine/ai.js", level=1)
pdf.body_text(
    "AI decision-making module for games with computer opponents. Game-agnostic: operates "
    "on abstract moves and evaluator functions. Any game with getValidMoves() and a scoring "
    "function can use this module."
)
pdf.code_block("""// Deterministic: always picks highest-scoring move
const move = pickBestMove(validMoves, evaluator);

// Probabilistic: higher scores have higher chance
const move = pickWeightedMove(validMoves, evaluator);

// Random: any valid move
const move = pickRandomMove(validMoves);

// Combine multiple evaluation strategies
const evaluator = compositeEvaluator([
  { fn: captureEval, weight: 0.6 },
  { fn: positionEval, weight: 0.3 },
  { fn: safetyEval, weight: 0.1 },
]);""", "AI Move Selection")

# ── CHAPTER 5: THE DSL ──────────────────────────
pdf.chapter_cover(5, "The DSL", "Embedded TypeScript Game Specifications")

pdf.add_page()
pdf.section_title("What is the DSL?")
pdf.body_text(
    "The Game Studio DSL is an embedded domain-specific language built on JavaScript/TypeScript. "
    "Rather than defining a custom grammar with a parser, it leverages JavaScript's native "
    "module system combined with the @engine SDK. Games are written as standard JavaScript "
    "files (game.js) that import from @engine/* modules."
)
pdf.body_text(
    "This approach gives developers full access to JavaScript's expressiveness while the "
    "SDK provides the domain-specific vocabulary: defineGame, component, resource, system, "
    "and a rich set of game helpers."
)

pdf.section_title("DSL Structure", level=1)
pdf.body_text("Every game.js follows this standard structure:")

pdf.code_block("""// 1. IMPORTS - Pull in SDK modules
import { defineGame } from '@engine/core';
import { consumeAction } from '@engine/input';
import { clearCanvas, drawGridBoard, drawHUD } from '@engine/render';
import { collides, rotateShape } from '@engine/grid';

// 2. CONSTANTS - Game configuration
const COLS = 10, ROWS = 20, CELL = 40;

// 3. GAME DEFINITION - Display and input config
const game = defineGame({
  display: { type: 'grid', width: COLS, height: ROWS, cellSize: CELL },
  input: { left: { keys: ['ArrowLeft'] }, ... },
});

// 4. COMPONENTS - Data shapes for entities
game.component('Position', { x: 0, y: 0 });
game.component('Piece', { shape: [], type: '' });

// 5. RESOURCES - Shared singletons
game.resource('state', { score: 0, gameOver: false });

// 6. SYSTEMS - Behavior (executed in order every frame)
game.system('spawn', function(world) { ... });
game.system('input', function(world) { ... });
game.system('physics', function(world) { ... });
game.system('render', function(world) { ... });

// 7. EXPORT - Makes game available to index.html
export default game;""", "Standard game.js Structure")

pdf.section_title("Display Types", level=1)
pdf.section_title("Grid Mode", level=2)
pdf.body_text(
    "For grid-based games (Tetris, Snake, Minesweeper, etc.). Canvas size is auto-calculated "
    "as width * cellSize + HUD_WIDTH. Coordinate system is cell-based (gx, gy)."
)
pdf.code_block("""display: {
  type: 'grid',
  width: 10,        // 10 columns
  height: 20,       // 20 rows
  cellSize: 40,     // 40px per cell
  background: '#111',
}
// Canvas = 10*40 + 180 = 580px wide, 20*40 = 800px tall""")

pdf.section_title("Custom Mode", level=2)
pdf.body_text(
    "For non-grid games (Ludo, card games, etc.). Developer specifies explicit canvas "
    "dimensions and offsets. Coordinate system is pixel-based."
)
pdf.code_block("""display: {
  type: 'custom',
  canvasWidth: 720,
  canvasHeight: 560,
  offsetX: 55,
  offsetY: 30,
  background: '#1a4d1a',
}""")

pdf.section_title("Component Patterns", level=1)
pdf.body_text("Components define pure data attached to entities. Common patterns:")

pdf.table(
    ["Pattern", "Component", "Fields", "Used In"],
    [
        ["Position", "Position", "x, y", "All games"],
        ["Motion", "Velocity", "dx, dy", "Snake, Pong, Breakout"],
        ["Identity", "Piece", "type, color, rotation", "Tetris, Chess"],
        ["Collection", "Snake", "segments: [{x,y}]", "Snake"],
        ["Board Token", "Token", "pos, finished, color", "Ludo, Checkers"],
        ["Selection", "Cursor", "x, y, selected", "Chess, Minesweeper"],
        ["Life", "Health", "hp, maxHp", "Roguelike, Tower Defense"],
    ],
    col_widths=[30, 35, 55, 70]
)

pdf.section_title("System Execution Order", level=1)
pdf.body_text(
    "Systems run in registration order every frame (~60fps). The standard order ensures "
    "correct data flow: spawn first, then input, then logic, then render."
)

pdf.diagram_box("System Pipeline Per Frame", """
  +-------+    +-------+    +--------+    +---------+    +--------+
  | spawn |    | input |    | update |    | physics |    | render |
  | (init |    | (read |    | (game  |    | (move   |    | (draw  |
  | once) |--->| keys) |--->| rules) |--->| & coll) |--->| canvas)|
  +-------+    +-------+    +--------+    +---------+    +--------+

  Frame timeline:
  |<-- 16ms (~60fps) ------------------------------------------>|
  | spawn | input | update | physics | render | events cleared  |
""")

pdf.section_title("Game Loop", level=1)
pdf.body_text(
    "The core game loop is managed by @engine/core. Each tick: poll keyboard input into "
    "the input resource, clear previous frame's events, execute all registered systems in "
    "order, then check for restart input."
)

pdf.code_block("""// Simplified game loop (inside @engine/core)
function gameLoop(timestamp) {
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  // Update input resource from keyboard state
  updateInputResource(world, keyboardState);

  // Clear frame-scoped events
  world.clearEvents();

  // Execute all systems in order
  for (const system of registeredSystems) {
    system(world, dt);
  }

  // Check restart
  if (consumeAction(world.getResource('input'), 'restart')) {
    resetWorld(world);
  }

  requestAnimationFrame(gameLoop);
}""", "Game Loop (Pseudocode)")

pdf.output(os.path.join(os.path.dirname(__file__), "ch04.pdf"))
print("ch04.pdf generated")
